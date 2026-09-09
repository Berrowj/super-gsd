---
schema_version: 2
phase: 170
plan: "170-09"
status: ACTIVE
authorized_by: operator
authorized_at: 2026-09-09
depends_on: ["170-08-T4-quality-pass"]
scope: LINUX_LAUNCH_SELECTION_AND_NEW_SESSION_HANDOFF
windows: OPEN_REQUIRED_SEPARATE
expected_ATC_tier: FULL
tasks:
  - id: T170-09-1
    agent: gsd-executor
    model: codex
    files_touched:
      - super-gsd/scripts/sgsd-remote-tmux.sh
      - super-gsd/scripts/sgsd-boot.sh
      - super-gsd/tests/propagation/runtime-provenance.test.cjs
    input_contract: "170-08 Task4 passes independent SPEC and registered QUALITY; the observed review CLI mismatch and isolated normal-launcher reproductions below."
    output_contract: "Test-first Linux selection/handoff repair with private zero-provider fixtures, source hashes and independent SPEC then registered QUALITY review."
    hypothesis: "Pinning the existing caller-selected native Codex before Node recovery and carrying a bounded environment into only the new tmux session prevents CLI substitution or loss of explicit selectors."
    falsifier: "NVM fallback or a reused tmux server changes the effective Codex selector/arguments, unknown selection is reported healthy, or an existing session/global environment is modified."
    stop_rule: "Named native Linux tests and both reviews pass without changing models/auth/defaults, sg topology or gate authority."
  - id: T170-09-2
    agent: codex-supervisor
    model: codex
    files_touched:
      - .planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/170-09-LINUX-LAUNCH-RECEIPT.json
      - .planning/STATE.md
    input_contract: "T170-09-1 reviewed changes plus frozen170-08 Task4 repair; existing guarded updater, complete protected-state inventory and root-confirmed raw-evidence mapping below."
    output_contract: "Published/installed source identity and an observed fresh normal-launcher receipt, linked to the new bounded170-08 acceptance."
    hypothesis: "Normal launcher propagation, rather than a benchmark-only override, carries the selected native executable through Fable into workers."
    falsifier: "The benchmark helper substitutes a Codex selector at Fable startup, native worker identity differs, or protected configuration/old sessions change."
    stop_rule: "Installed hashes, genuine launcher-to-worker provenance and preservation evidence recorded; failed acceptance stops without automatic retries."
semantic_acceptance_criteria:
  - input: "Retained raw mailbox, registration, native TokenUsageRecord and accepted ledger row from one fresh worker."
    expected_outcome: "Mailbox run/thread/turn join to registered native usage; native-only response/session/root identities and counts project to the actual accepted canonical row."
    verification_cmd: >-
      node -e "const fs=require('node:fs'),p=require('node:path'),c=require('node:crypto'),k=require('./super-gsd/tools/telemetry-atlas/contract.cjs'),u=require('./super-gsd/tools/codex-worker/usage.cjs'),q=require('./super-gsd/tools/telemetry-atlas/accounting.cjs'),f=p.resolve('.planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/170-09-LINUX-LAUNCH-RECEIPT.json'),a=JSON.parse(fs.readFileSync(f));const read=n=>{const r=a.evidence[n],b=fs.readFileSync(p.resolve(p.dirname(f),r.path));if(!/^[a-f0-9]{64}$/.test(r.sha256)||c.createHash('sha256').update(b).digest('hex')!==r.sha256)throw Error(n+' hash');return JSON.parse(r.line===undefined?b.toString():b.toString().split('\n')[r.line-1])};const w=read('worker'),r=read('registration'),t=read('native'),e=read('accepted');if(a.evidence_kind!=='observed_linux_launcher_worker'||!w.worker_id||!w.instance||!w.atlas_run_id||w.atlas_run_id!==r.run_id||r.project_dir!==w.project||k.digest(r.project_dir)!==r.project_id||r.accountingSource!=='codex_rollout'||r.provider!=='openai'||r.role!==w.role||w.atlas_run_id!==e.identity.sgsd_run_id||!w.thread_id||!w.turn_id||w.thread_id!==e.identity.thread_id||w.turn_id!==e.identity.turn_id)throw Error('worker registration join');const n=u.projectUsageRecord(t,{run:r,threadId:w.thread_id,turnId:w.turn_id,model:w.model,modelProvider:e.runtime.model_provider,runtimeVersion:e.runtime.codex_version}).event;if(!n||k.validate(n)||q.scopeReason(n,r)||!q.classifyAccounting(n,r).eligible||n.usage.total_provider_tokens<=0||k.digest(k.canonicalize(n,e.ingested_at))!==k.digest(e))throw Error('native accepted projection')"
  - input: "Raw launch record and retained installed-hashes.json with both launchers and the shared helper."
    expected_outcome: "Launch source identity matches installed source; all three required installed script entries match their source hashes."
    verification_cmd: >-
      node -e "const fs=require('node:fs'),p=require('node:path'),c=require('node:crypto'),f=p.resolve('.planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/170-09-LINUX-LAUNCH-RECEIPT.json'),a=JSON.parse(fs.readFileSync(f));const read=n=>{const r=a.evidence[n],b=fs.readFileSync(p.resolve(p.dirname(f),r.path));if(!/^[a-f0-9]{64}$/.test(r.sha256)||c.createHash('sha256').update(b).digest('hex')!==r.sha256)throw Error(n+' hash');return JSON.parse(b)};const l=read('launcher'),m=read('installed');if(!/^[a-f0-9]{40}$/.test(l.source_sha)||l.source_sha!==m.source_sha)throw Error('source identity');for(const s of ['sgsd-remote-tmux.sh','sgsd-boot.sh','lib/codex-worker-shell.sh']){const rows=m.manifest.filter(x=>x.installed==='/home/jackberrow/.claude/super-gsd/scripts/'+s);if(rows.length!==1||!rows[0].source.endsWith('/super-gsd/scripts/'+s)||!/^[a-f0-9]{64}$/.test(rows[0].source_sha256)||rows[0].source_sha256!==rows[0].installed_sha256)throw Error(s)}"
  - input: "Content-free OS observation linking the launch operator pane, orchestrator, raw mailbox adapter PID and native executable."
    expected_outcome: "Rechecked ancestry and executable identities bind the operator to the launch's Claude binary and exact Fable/xhigh submitted-prompt digest, then to the adapter/native child; no raw argv or environment is retained."
    verification_cmd: >-
      node -e "const fs=require('node:fs'),p=require('node:path'),c=require('node:crypto'),k=require('./super-gsd/tools/telemetry-atlas/contract.cjs'),f=p.resolve('.planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/170-09-LINUX-LAUNCH-RECEIPT.json'),a=JSON.parse(fs.readFileSync(f));const read=n=>{const r=a.evidence[n],b=fs.readFileSync(p.resolve(p.dirname(f),r.path));if(!/^[a-f0-9]{64}$/.test(r.sha256)||c.createHash('sha256').update(b).digest('hex')!==r.sha256)throw Error(n+' hash');return JSON.parse(b)};const l=read('launcher'),w=read('worker'),o=read('os'),h=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),nodes=new Map(o.processes.map(x=>[x.pid,x]));if(!o.boot_id||o.boot_id!==o.recheck_boot_id||nodes.size!==o.processes.length||o.operator_pane!==l.operator_pane)throw Error('OS scope');for(const x of nodes.values())if(!Number.isSafeInteger(x.pid)||x.pid<=0||!Number.isSafeInteger(x.ppid)||!x.start_time||!p.posix.isAbsolute(x.executable)||!h(x.executable_sha256)||k.digest(x)!==k.digest(o.rechecked_processes.find(y=>y.pid===x.pid)))throw Error('process recheck');const operator=nodes.get(o.operator_pid),cli=l.orchestrator_cli,inv=o.orchestrator_invocation;if(!operator||!cli||!p.posix.isAbsolute(cli.path)||!p.posix.isAbsolute(cli.resolved_path)||!h(cli.sha256)||operator.executable!==cli.resolved_path||operator.executable_sha256!==cli.sha256||!inv||inv.model_selector!=='fable'||inv.effort_selector!=='xhigh'||!h(l.submitted_prompt_sha256)||inv.submitted_prompt_sha256!==l.submitted_prompt_sha256)throw Error('actual orchestrator invocation');const pane=l.panes.find(x=>x.pane===l.operator_pane),ancestor=(child,parent)=>{const seen=new Set();while(child!==parent){if(seen.has(child)||!nodes.has(child))return false;seen.add(child);child=nodes.get(child).ppid}return nodes.has(parent)};if(!pane||o.native_pid===w.pid||o.operator_pid===w.pid||!ancestor(o.operator_pid,pane.pid)||!ancestor(w.pid,o.operator_pid)||!ancestor(o.native_pid,w.pid))throw Error('launch ancestry');const native=nodes.get(o.native_pid);for(const pid of [o.operator_pid,w.pid]){const s=o.selectors.find(x=>x.pid===pid);if(!s||!p.posix.isAbsolute(s.command)||s.resolved_executable!==native.executable||s.executable_sha256!==native.executable_sha256)throw Error('selected executable');for(const key of ['SGSD_CODEX_COMMAND','SGSD_CODEX_APP_SERVER_ARGS','SGSD_CODEX_FORCE_LAUNCHER']){const v=s.optional[key];if(!v||typeof v.present!=='boolean'||(v.present?!h(v.value_sha256):v.value_sha256!==null))throw Error('selector metadata')}}if(o.selectors.find(x=>x.pid===o.operator_pid).command!==o.selectors.find(x=>x.pid===w.pid).command||k.digest(o.selectors.find(x=>x.pid===o.operator_pid).optional)!==k.digest(o.selectors.find(x=>x.pid===w.pid).optional))throw Error('selector drift')"
  - input: "Original pre/post protection collector arrays, including seven protected files and the complete pin inventory."
    expected_outcome: "No protected file, pin or model/default drift; original arrays are retained rather than replaced by summary booleans."
    verification_cmd: >-
      node -e "const fs=require('node:fs'),p=require('node:path'),c=require('node:crypto'),k=require('./super-gsd/tools/telemetry-atlas/contract.cjs'),f=p.resolve('.planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/170-09-LINUX-LAUNCH-RECEIPT.json'),a=JSON.parse(fs.readFileSync(f));const read=n=>{const r=a.evidence[n],b=fs.readFileSync(p.resolve(p.dirname(f),r.path));if(!/^[a-f0-9]{64}$/.test(r.sha256)||c.createHash('sha256').update(b).digest('hex')!==r.sha256)throw Error(n+' hash');return JSON.parse(b)};const b=read('protected_before'),d=read('protected_after');if(b.protected_files.length!==7||!b.pin_files.length||!b.claude_model_effort||k.digest(b.claude_model_effort)!==k.digest(d.claude_model_effort))throw Error('protected inventory');for(const key of ['protected_files','pin_files']){const rows=v=>v[key].map(x=>{if(typeof x.exists!=='boolean'||!x.file||(x.exists&&!/^[a-f0-9]{64}$/.test(x.sha256)))throw Error('unavailable file');return x}).sort((x,y)=>x.file.localeCompare(y.file));if(new Set(b[key].map(x=>x.file)).size!==b[key].length||k.digest(rows(b))!==k.digest(rows(d)))throw Error(key+' drift')}"
  - input: "Separate content-free pre/post tmux snapshots covering the complete pre-existing session inventory."
    expected_outcome: "Server identity, environment/option digests and all existing pane metadata match, including explicitly verified dead panes; unknown evidence fails and drift is not automatically blamed on the launcher."
    verification_cmd: >-
      node -e "const fs=require('node:fs'),p=require('node:path'),c=require('node:crypto'),k=require('./super-gsd/tools/telemetry-atlas/contract.cjs'),f=p.resolve('.planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/170-09-LINUX-LAUNCH-RECEIPT.json'),a=JSON.parse(fs.readFileSync(f));const read=n=>{const r=a.evidence[n],b=fs.readFileSync(p.resolve(p.dirname(f),r.path));if(!/^[a-f0-9]{64}$/.test(r.sha256)||c.createHash('sha256').update(b).digest('hex')!==r.sha256)throw Error(n+' hash');return JSON.parse(b)};const b=read('tmux_before'),d=read('tmux_after'),v=read('protected_before'),h=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);for(const x of [b,d]){if(x.available!==true||!x.server.boot_id||!x.server.start_time||!Number.isSafeInteger(x.server.pid)||!h(x.global.environment_sha256)||!h(x.global.update_environment_sha256)||!x.sessions.length||new Set(x.sessions.map(s=>s.id)).size!==x.sessions.length)throw Error('tmux unavailable');for(const s of x.sessions)if(!s.id||!s.name||!h(s.environment_sha256)||!h(s.update_environment_sha256)||!s.panes.length||s.panes.some(p=>!p.pane||typeof p.pane_dead!=='boolean'||typeof p.pane_dead_status!=='string'||!Number.isSafeInteger(p.identity?.pid)||p.identity.pid<=0||(p.pane_dead?(p.absence_proof!=='ESRCH'||p.identity.absent!==true||Object.keys(p.identity).sort().join(',')!=='absent,pid'):(p.absence_proof!==null||Object.hasOwn(p.identity,'absent')||!p.identity.start_time||!p.identity.executable||!h(p.identity.argv_sha256)))))throw Error('session unavailable')}for(const pane of v.panes)if(!b.sessions.some(s=>s.name===pane.session&&s.panes.some(p=>p.pane===pane.pane&&k.digest(p.identity)===k.digest(pane.identity))))throw Error('session inventory');if(k.digest({server:b.server,global:b.global,sessions:b.sessions})!==k.digest({server:d.server,global:d.global,sessions:d.sessions}))throw Error('tmux drift')"
---

# Preserve native Codex selection across Linux launches

## Explicit timeout continuation (2026-09-09 16:20Z)

The final freeze passes SPEC02 and root native integration ELwlRb. Its first
actual registered QUALITY invocation timed out after180.749s with no verdict;
the original179-byte stub, exclusive attempt marker and canonical timeout
evidence remain intact. The structural diagnostic
`root-17009-timeout-diagnostic-46NWHD` (manifest SHA-256
`234587ebcbd4dd59dba65b4d62d3a9e1c8ff3a1f9092d7155cc7a8928ae3e368`)
proves a started, progressing review: all14 tool calls returned, no question was
pending, and there was no final answer before the deadline. PID2837564 is
positively absent by ESRCH and the exact thread claim is absent. All1,106 inputs
and protected evidence are unchanged. This does not establish a code verdict
or independently prove every detached tool process stopped.

T1 now authorizes exactly one separately recorded180-second same-thread
continuation of worker `ad8fc494-a92d-42fd-a3b0-2a4e80a3cbb9`, thread
`01a086f2-69a1-70e3-b7e1-c0c3446b097e`, in the same private ELwlRb project.
Recheck status, pending requests, model/effort, original report/attempt and
positive absence/claim proof immediately before launch. Preserve source,
review criteria, exact secondary validator, original failure evidence, actual
review profile and normal resume mechanism. A distinct exclusive continuation
marker limits this to one new invocation; do not delete the original marker.
Use retained review work rather than repeating completed broad inspection,
without requesting or assuming PASS. No source import, extra test, model swap,
automatic retry or timeout-default change is authorized. Another failure remains
blocked for diagnosis. Publication still requires a genuine valid QUALITY verdict.

Resume2026-09-09 16:02Z: actual170-08 QUALITY05 completed16:00:03.415Z on the
unchanged four-file freeze, same original thread. Its original157-byte report
SHA-256 `572509fd8f7cd0896bc20e84323450cff215b0af3df22705cf76ceabc1d88181`
passes the exact existing secondary validator: FINDINGS0, CRITICAL0, WARNINGS0,
PASS_RATE10/10. All1,106 inputs remained unchanged and report04 was preserved.
Corrective and new PASS ledger receipts are retained separately. T1 resumes only
the two bounded SPEC01 fixes from its meaningful0/2 RED checkpoint. Its own
SPEC02 and registered QUALITY still precede publication/acceptance.

Dependency correction2026-09-09 15:52Z: root independently executed the existing
orchestrator `validateContract` guard and found170-08 QUALITY04 format-invalid
(`FINDINGS: none`, `PASS_RATE: 100%`). The earlier activation paragraph below is
retained as history, not current authority. T1 is paused at its safe checkpoint
after SPEC01's two meaningful RED cases; no repair has been applied for those
findings. Remote/boot retain b2a44c89/4a985b9c; added test hash5854f64e is retained.
Resume only after a genuinely contract-valid170-08 registered QUALITY receipt.
No older review, implementation evidence or actual failed acceptance is replaced.

Activated2026-09-09 13:43Z after170-08 Task4 SPEC06, independently reconciled
native integrationP3RNwg and registered QUALITY04 PASS (CRITICAL0/WARNINGS0,
PASS_RATE100). Actual worker `c8135301-7e1f-4368-97f6-9d7a96b2d448` completed
13:41:21.940Z. The verbatim report and canonical ledger writes remain in170-08.
This activates T170-09-1 only; publication/deployment/live acceptance are still
gated on this plan's own specification and quality reviews. No P170 close or
complete telemetry coverage is claimed.

For agentic workers: use subagent-driven-development, one implementer, then
independent specification and registered quality review. Root owns publication,
deployment and live acceptance. Do not begin implementation before the dependency
above passes. The operator's instruction to finish Linux collection covers this
observed launch defect; no unrelated launch redesign or P169 activation is inferred.

## Evidence and design

The 170-08 actual review harness selected NVM's Codex0.144.3 ahead of the installed
`.local/bin/codex`0.153.4, producing no accepted native per-response usage. A
diagnosed continuation using the latter produced one accepted native response.
This does not establish exhaustive usage coverage or authorize model substitution.

The unmodified normal launcher independently reproduces the same order. Private
zero-provider evidence is `/tmp/sgsd-launcher-path-audit-GabHUH/` on DEVCP, with
its harness/copied source at `/tmp/sgsd-launcher-audit-source.pG1ZdJ/`. `--doctor`
selects the fixture NVM CLI despite an incoming and a local CLI. Fake-tmux
new-server handoff selects NVM; fake existing-server handoff selects stale-server
Codex and loses the caller's explicit command and prefix arguments. This is a
controlled reproduction, not an observation of the production tmux server.

`sgsd-boot.sh` has the same recovery order and checks bare Codex afterwards.
Neither a benchmark-only explicit pin nor worker tests starting below this
launcher boundary proves ordinary boots correct. Bash login profiles in shell
mode can also alter PATH after the launcher; the absolute selected Codex pin
must therefore be independent of later PATH changes.

## Implementation contract

- Reuse the existing worker selector rules/helpers rather than creating a
  second selection algorithm: explicit app-server command, explicit legacy
  command, incoming Codex, native local fallback, native NVM fallback. Resolve
  against the original caller cwd and original PATH before any outer-shell
  project/framework `cd` or Node PATH recovery. This includes both relative
  executable selectors and relative entries in PATH. Preserve intentional
  selectors and prefix argument bytes; reject a nonempty invalid explicit
  selector without substituting another CLI. Empty selectors retain the
  existing helper's default-selection meaning.
- Read and reuse `super-gsd/scripts/lib/codex-worker-shell.sh`; copy that actual
  helper, unchanged, into each source/installed-layout fixture that needs it.
  Do not invent a fixture-only selector or invoke the worker wrapper, worker
  preparation, profile loading, `--self-test` or a model/auth probe to select
  an executable. In particular, bootstrap's `--self-test` relaxes explicit
  failure and cannot stand in for production selection. Any required helper
  source modification needs a separately reviewed plan-scope amendment first.
- Distinguish explicit selection failure from missing default: preserve the
  remote doctor's diagnostic return/warning behaviour and Bash boot's existing
  missing-Codex exit 7; neither may label missing/interop selection healthy.
  Preserve `--help` and `--skip-preflight` side-effect boundaries. The existing
  boot `login status` check follows the effective selected executable (and its
  intended prefix arguments), retaining existing auth-failure exit 8; do not
  add login checks to previously probe-free paths or introduce provider probes.
- Keep native Node recovery and framework/project provenance checks. Do not
  alter profile model IDs, efforts, auth, credentials, account settings or CLI
  installations. Windows/macOS behaviour is not certified by this Linux task;
  avoid imposing a new Linux-only failure on the existing other-platform paths.
- Carry only the required PATH and Codex selector/argument environment into the
  newly created tmux session, using supported session-scoped environment passing
  or command-local bindings. The bounded addition is `PATH`, the resolved
  `SGSD_CODEX_APP_SERVER_COMMAND`, `SGSD_CODEX_COMMAND`,
  `SGSD_CODEX_APP_SERVER_ARGS`, and `SGSD_CODEX_FORCE_LAUNCHER`; preserve existing
  Atlas provenance bindings. Preserve each explicitly supplied optional value
  byte-for-byte, including empty values. Explicit FORCE_LAUNCHER intent is not
  silently rewritten to `direct`: the existing worker retains authority to
  reject `cmd` or invalid values. For absent optional variables, explicitly
  unset them or bind an empty value with the same existing consumer semantics,
  so stale server values cannot reappear. Do not use global `set-environment`,
  alter `update-environment`, or modify any existing session/pane. No wholesale
  environment inheritance workaround or environment/auth dump in telemetry.
- Preserve direct Claude execution in the operator pane, separate cockpit
  panes, greet/go/shell modes, argument boundaries and normal exit handling.
  Do not add nested launchers, choose a new orchestrator model or add paid probes.
- Bash boot health checks must inspect the same selected Codex used by workers,
  not a different bare command after PATH recovery. It still prints instructions;
  it does not start a hidden orchestrator or claim every separate terminal inherits
  its environment.

## Tests and handoff

First demonstrate RED using the actual launcher with private fake executables
and a fake tmux server. Extend `runtime-provenance.test.cjs` to cover competing
incoming/local/NVM locations, Node fallback, absolute/relative/bare explicit
selectors, invalid explicit selection, preserved arguments containing spaces and
quotes, absent optional values versus stale server values, and greet/go/shell
handoff. Exercise Bash boot's selection health path without production auth or
provider calls. Assert zero provider calls and no global/existing-session updates.

Include a caller-cwd A/project-cwd B case where the relative executable and
relative PATH entry exist only in A. Assert executable selection itself invokes
no fake CLI, worker preparation or login command; exercise existing preflight
checks separately with harmless fakes. Fixtures must explicitly own HOME,
source/project roots and the real shared-helper copy, including installed-layout
and other-platform regression cases. Cover explicit FORCE_LAUNCHER `direct`,
`cmd`, invalid, empty and absent cases without silently changing caller intent.

The fake tmux must execute the actual emitted operator command under both a
new-server and a stale-server environment; string inspection alone is not
sufficient. Resolve fake `claude` through the controlled PATH, not by rewriting
the emitted command to an absolute fake path. Exercise the emitted `bash -l`
handoff with a controlled fake login shell that mutates PATH; do not delete or
rewrite that handoff. Assert final selector/argument bytes, fake Claude argv,
exit handling, greet/go/shell behaviour and direct operator/separate cockpit
topology. Cover existing-session attach/reuse without mutating that session.
No real tmux server, live worker, production launcher or provider call is used
for these tests; genuine launch provenance belongs only to T170-09-2.

Run tests only from disposable copied source/project/HOME fixtures, never the
user or installed source worktree. Re-run the existing named worker, Atlas,
board/routing and propagation suites; the seven independently reproduced legacy
snapshot-contract failures remain classified separately, not loosened or called
PASS. Preserve evidence of every failed run and test-harness correction.

After independent SPEC and registered QUALITY pass, publish through normal Git
and install through the existing guarded Linux updater with a fresh protected
baseline. The next 170-08 acceptance must inherit the installed launcher's pin:
remove any benchmark-only Codex-selector substitution before Fable starts.
Observe the actual native child executable and exact worker/run/native identities.
Keep B0 non-writing, B1 scoped, five-worker/180-second/20-minute limits and the
existing B0-B7 criteria. No automatic retry or repair during the acceptance.

## Retained acceptance evidence (root-confirmed raw mapping)

The SAC commands are small, read-only evidence checks, not new SGSD gates.
They reuse `usage.projectUsageRecord`, accounting checks and Atlas
`contract.validate`, `canonicalize` and `digest`; they neither ingest events nor
replace independent SPEC/registered QUALITY or B0-B7 acceptance. No new verifier
framework or source instrumentation is authorized. Missing observations stop
acceptance; do not manufacture summarized launcher/worker records to fill gaps.

The receipt contains `evidence_kind: observed_linux_launcher_worker` and an
`evidence` dictionary with `launcher`, `installed`, `worker`, `registration`,
`native`, `accepted`, `os`, `protected_before`, `protected_after`, `tmux_before`,
`tmux_after`. Each reference is `{path, sha256}`; `accepted` may additionally
specify a one-based `line` in a retained JSONL file. Recompute SHA-256 over the
complete original retained file bytes before parsing, not reserialized records.
Paths are local absolute paths or relative to the receipt. Retain the actual
files locally, including evidence captured on DEVCP, without overwriting older
evidence. For `native`, retain exactly one original content-free
`token_usage_record` JSONL line with its source path/line/byte-range provenance
in the receipt reference; do not copy or dump surrounding prompts or reasoning.

### Raw records and joins

- `launcher`: the existing `root-launch-record.json`, with `session`,
  `operator_pane`, `panes[].{pane,title,pid}`, `source_sha` and timestamps.
  The next one-use launch record additionally embeds the independently captured
  `orchestrator_cli:{path,resolved_path,version,sha256}` from retained
  `orchestrator-cli.json`, plus `submitted_prompt_sha256`. It still has no
  worker list, worker executable identity or native session ID. Preserve older
  records as written rather than backfilling these prospective fields.
- `installed`: existing `installed-hashes.json`, with `source_sha` and
  `manifest[].{source,installed,source_sha256,installed_sha256}`. Require the
  installed `sgsd-remote-tmux.sh`, `sgsd-boot.sh` and unchanged
  `lib/codex-worker-shell.sh` entries under
  `/home/jackberrow/.claude/super-gsd/scripts/`, not just the previous manifest's
  size or an `unresolved` boolean. Preserve the complete original manifest and
  existing derived-agent handling; root compares it to the frozen publication.
- `worker`: the actual `<project>/.planning/worker-sessions/<worker_id>/state.json`.
  Use `worker_id`, `instance`, `pid`, `atlas_run_id`, `thread_id`, `turn_id`,
  `wrapper_attempt_id`, `project`, `role`, `model`. `pid` identifies the Node
  adapter, not Codex. `usage_capture.queued_observations` is not acceptance proof.
- `registration`: actual `<global>/runs/<atlas_run_id>/registration.json`.
  Join mailbox `atlas_run_id` to `run_id`; verify `project_dir/project_id`,
  `provider`, `role` and `accountingSource` against existing accounting rules.
- `accepted`: the actual canonical row in
  `<registration.metrics_dir>/sgsd-atlas-events-*.jsonl`. Join mailbox
  `atlas_run_id/thread_id/turn_id` to `identity.sgsd_run_id/thread_id/turn_id`.
  Native `session_id/root_turn_id/response_id` belong here and in the native
  provider record, not invented mailbox fields. The tmux session remains a
  separate identity. Preserve existing Atlas audit treatment of conflicts;
  reconstructing a canonical row is not a substitute for a retained ledger row.
- `native`: the matching raw `token_usage_record` with `timestamp`, `type` and
  `payload.{thread_id,turn_id,session_id,root_turn_id,response_id,usage}`.
  Project only per-response `usage` through existing `usage.projectUsageRecord`;
  do not use its cumulative `turn_token_usage` or `thread_token_usage` fields.
  Supply the raw registration and mailbox thread/turn/model. The SAC uses
  accepted `model_provider/codex_version` as dependent projection context;
  those fields are explicitly NOT independent model/version/executable proof.
  Version may legitimately be null. Actual executable proof is the OS capture.

Implementation references: `super-gsd/tools/codex-worker/mailbox.cjs:75`,
`run.cjs:50`, `usage.cjs:12`, and
`super-gsd/tools/telemetry-atlas/global-store.cjs:25`, `contract.cjs:64`.
The sealed earlier acceptance at
`/home/jackberrow/benchmarks/sgsd-linux-completion-20260909-aNXZ7y/fable-acceptance-20260909T095210Z-Kc6ELC`
contains no worker states and its parent has no `native-cli.json`; it cannot
satisfy these joins. The current mutable one-use launch helper's newer CLI pin
does not establish the older run's environment. Retain both histories without
retrospectively treating review-worker evidence as normal-launch acceptance.

### Minimal content-free OS observation

Confine this prospective dictionary to the one-use benchmark observer; it is
not an SGSD runtime record or mailbox schema change:

```text
{observed_at, boot_id, recheck_boot_id, operator_pane, operator_pid, native_pid,
 orchestrator_invocation: {model_selector, effort_selector, submitted_prompt_sha256, argv_sha256},
 processes: [{pid, ppid, start_time, executable, executable_sha256}],
 rechecked_processes: [same exact identity fields],
 selectors: [{pid, command, resolved_executable, executable_sha256,
   optional: {SGSD_CODEX_COMMAND: {present, value_sha256},
              SGSD_CODEX_APP_SERVER_ARGS: {present, value_sha256},
              SGSD_CODEX_FORCE_LAUNCHER: {present, value_sha256}}}]}
```

`operator_pid` is the actual orchestrator process beneath the raw launch record's
operator pane PID, not merely an arbitrary ancestor with a matching selector.
Bind its observed executable path and byte digest to
`launcher.orchestrator_cli.resolved_path/sha256`, retaining the original selector
`path` and the preflight `orchestrator-cli.json`. The one-use observer inspects
only this exact process's initial argv internally: verify `--model fable`,
`--effort xhigh` and the last initial prompt argument's SHA-256 against
`launcher.submitted_prompt_sha256`. Emit only the content-free
`orchestrator_invocation` fields above; no argv or prompt plaintext. The launch
digest must account for Bash command substitution stripping trailing newlines;
keep it distinct from `task_sha256`, which hashes the entire original task file.
Recheck process identity around this observation; missing/mismatched invocation
evidence fails. Do not require executable uniqueness across all ancestors:
the exact invocation digest disambiguates processes sharing an executable.
This proves the observed CLI invocation, not the provider's wire model identity.

Capture its full ancestor/descendant chain through raw mailbox
`pid` to the actual native executable, with `/proc` PPID/start identity and boot
ID rechecked around the observation. For the normal direct-native selection,
the native process is the adapter's direct child. Preserve and explicitly review
any intentional caller-selected wrapper chain rather than hiding intermediate
processes or silently imposing a new override. Every referenced process must be
observed, not inferred from cwd matches or timestamps. PID reuse, early exit,
missing ancestry or unreadable identity is unavailable evidence and fails.

Capture selector entries for the actual orchestrator and adapter PIDs.
`command` is only the effective absolute Codex selector, with resolved executable
and actual executable-byte digest matching the observed native child. Optional
values are presence plus SHA-256 of the exact bytes, or `{present:false,
value_sha256:null}` when absent; never retain their plaintext. Record no other
environment variables, full argv, prompts, auth or reasoning. The observer
hashes only approved metadata internally and writes no environment dump. Root
checks observer origin and absence of benchmark selector substitution; digest
equality alone does not establish that an observation was genuinely captured.

### Original protection arrays and separate tmux digests

Retain the original protection collector objects, not a replacement nested
`state` schema: `protected_files[]`, `pin_files[]`, `panes[]`,
`additional_protected_processes[]`, `claude_model_effort` and other existing
metadata. Preserve all seven protected configuration files, including auth
file digests without content, and the complete pin inventory. Compare each
original file row by path, existence and hash; absent is explicit and unreadable
is failure. Root reviews original protected process identities as well.
Keep the guarded updater's existing authorized deployment checks. The strict
pin-equality SAC pair brackets the fresh launch after guarded deployment; retain
the earlier deployment baseline separately rather than hiding authorized source
publication in a rewritten baseline or inventing new pin exceptions.

Tmux evidence is a separate prospective one-use capture:

```text
{observed_at, available,
 server: {pid, start_time, boot_id},
 global: {environment_sha256, update_environment_sha256},
 sessions: [{id, name, environment_sha256, update_environment_sha256,
             panes: [{pane, pane_dead, pane_dead_status, absence_proof,
                      identity: {pid, start_time, executable, argv_sha256}}]}]}
```

Enumerate the complete pre-existing session inventory using stable tmux IDs,
including every session represented in raw `before-protection.json.panes`.
Sort sessions by ID and panes by ID for deterministic comparison. Bind pane
identities to the original collector identities; retain no argv plaintext.
Capture tmux `pane_dead` as a boolean and `pane_dead_status` as the exact raw
status string, including an empty string if that is what tmux reports. A live
pane requires the full identity above and `absence_proof:null`. The only allowed
absent identity is exactly `{pid,absent:true}` for `pane_dead:true`, accompanied
by `absence_proof:'ESRCH'`: root's one-use observer must independently confirm
the actual tmux dead flag and `kill(pid,0)` ESRCH around the capture, while
rechecking that the same pane/PID/dead metadata remains present. Missing `/proc`
files alone do not establish death; permission errors or unreadable live
identity remain failures. A live-to-dead transition during capture is not a
stable observation and cannot be silently normalized.

Preserve verified retained dead panes without demanding impossible live process
metadata. The observed case is session `sgsd-worker-benchmark-20260908T1858`,
pane `%7`, PID `1293408`; this is context, not a hardcoded exemption. Match its
raw `before-protection.json` identity `{pid,absent:true}` exactly, and compare
all new observer dead/status/absence metadata exactly before and after alongside
the live panes. A vanished pane/session, missing tmux flag, failed absence
proof or changed metadata still fails. Never infer `pane_dead:true` from an
absent PID, and never alter or close a retained dead pane to satisfy the check.

Internally capture and hash `tmux show-environment -g`, and
`tmux show-environment -t <existing-session-id>` for every baseline session.
Sort environment records before hashing, preserving unset-variable markers.
Also hash global and per-session `update-environment` option observations,
including inherited effective values; do not modify either option or environment.
Emit digests only. Before/after observations use the same complete baseline
session set; exclude only the newly created acceptance session from this
comparison, retaining its separate launch evidence. Missing sessions, an
unreadable option/environment, server restart or incomplete inventory fail;
unknown must never become an empty matching digest. Preserve the raw failure
and report observed drift without automatically blaming the launcher when other
live sessions may have changed concurrently. No retries, repairs or session
mutation are authorized by these read-only checks.

This plan does not close P170, activate P171/P172, provide general rollback,
resolve the parked snapshot transaction, or substitute tests for calibration.
