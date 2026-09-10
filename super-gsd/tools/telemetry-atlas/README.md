# SGSD telemetry Atlas capture foundation

Atlas is local, content-free telemetry. After updating SGSD, its normal launch
paths automatically start or reuse one shared receiver per OS user and machine,
with a fresh run registration for each session or Codex dispatch. No manual
`SGSD_ATLAS_STATE_DIR` export, per-project enable, model call, or binary download
is required. Node 22+ is required. Windows and Linux are supported separately;
Windows, WSL and remote hosts do not share a collector automatically.

## Automatic collection and weekly check

Update through the normal SGSD updater/global installer, then start a fresh
`sg` session in any SGSD project (a directory containing `.planning`, or a child
directory). Existing sessions are not retrofitted. The standard interactive,
headless, remote-tmux, recovery/watchdog, narrator and Codex wrapper launch paths
attach themselves. Standalone provider CLIs, desktop sessions and ad-hoc
benchmark/probe runners outside those launch paths are not automatically covered.

The receiver uses ephemeral loopback ports and a private discovery file under
`~/.local/state/sgsd/telemetry/global`. Project paths are resolved and hashed;
private registration records map those hashes back to projects. Native events
cannot select another project's ledger by supplying their own path or run ID.
Evidence is stored under `projects/<digest>/metrics`, with separate private
run registrations and spools. Raw prompts, responses, tool bodies, credentials
and provider metadata outside the allowlist are not retained. On Windows these
files inherit the user's directory ACLs; POSIX private modes are also applied.

On Linux, a normal full `sgsd-update` transitions an already-running receiver
only after proving its exact process identity, trusted source entry, health,
root and ownership of all three loopback ports. The replacement keeps those
ports and existing registrations, and health reports an immutable fingerprint
of the code closure loaded at startup (including native normalizers). A private,
durably synced transition journal makes failure an explicit retry instead of a
fresh launch; it does not delete spools or ledgers. Disabled and absent services
are no-ops. `--check`, `--no-install`, and ordinary launcher startup never
upgrade a receiver. Windows revision transition remains open.

The fingerprint hashes the compiled named receiver entry plus dependency bytes
that remain identical in uncached snapshots before and after eager loading. A
cached or changing dependency context has an unknown fingerprint: status and
audit remain read-only, while registration, start and revision transition are
refused. This proves loaded-version coherence for the normal Node entry; it is
not a security attestation against an arbitrary external loader transform.

From PowerShell, after the global update:

```powershell
node "$env:USERPROFILE/.claude/tools/telemetry-atlas/audit.cjs" --json
```

From Bash:

```sh
node "$HOME/.claude/tools/telemetry-atlas/audit.cjs" --json
```

In the source checkout, `npm run atlas:audit` runs the same read-only report.
Exit codes: **0** = checked evidence passed; **10** = missing/degraded coverage;
**1** = integrity failure. The report covers registered projects and runs, checks
schema, checksums, duplicates/conflicts, closed-file manifests, project/provider
attribution, spool backlog, stale observations and missing native requests.
It also embeds the separately validated operational-capture report. To inspect
that content-free report directly, including every supported family, idle or
excluded input, pending work, rejected/uncorrelated observations, receipt replay,
typed MUDA coverage and capture lag, run:

```sh
node "$HOME/.claude/tools/telemetry-atlas/operation-report.cjs" --verify-sources --json
# Optional exact registered-project selection; paths are never inferred as production:
node "$HOME/.claude/tools/telemetry-atlas/operation-report.cjs" --project-id <64-hex-project-id> --verify-sources --json
```

Its totals count source observations, not inferred distinct actions, and contain
no token or cost totals. `--verify-sources` reconciles stored byte ranges and
digests against the current safe source files. Mismatch is a failure; a missing,
superseded, unsafe, racing or bounded-out source is explicitly incomplete. The
report validates operational canonical events against their receipts, and an
accepted receipt alone is not proof of capture. Producer time and collector
observation time are kept distinct; absent producer time remains unknown.
It never repairs or deletes evidence. A launcher registration alone is not proof
of provider capture. Legacy requests without stable provider request IDs remain
coverage observations without token totals. Linux workers can instead provide
native completed-response observations as described below. Account quota snapshots are unallocated and
must not be summed across projects. `complete_coverage` remains false: this is
not yet a reconciliation against provider billing or every request issued.

### Native Linux Codex response observations

Normal Linux SGSD worker wrappers register immutable `codex_rollout` accounting
authority. Their adapter reads only the exact returned native rollout file,
selecting the acknowledged worker thread/turn. Existing files start at pre-turn
EOF. Fresh native threads can return a path before its file/date-directories
exist: the explicit fresh-opening branch snapshots absence and pins existing
ancestors, then opens only that exact safely created file after ACK at offset
zero. Missing resume/null paths, changed ancestors and post-open disappearance
remain degraded; the reader never creates native files or scans for alternatives.
Standalone Codex `token_usage_record` per-response usage (release 0.153.2 source
contract) is projected into the existing private spool. Prompts, response text,
tool bodies, cumulative thread/turn snapshots, and resumed/forked old history
are not copied. Internal child threads and standalone/manual CLI runs are outside
this reader's scope; legacy registrations remain unchanged.

True native `response_id`, session/thread/turn/root-turn identities are retained;
HTTP `request_id` remains null. Same-response/same-payload replay is a duplicate;
changed usage, timestamp or attribution is a conflict, not another spend.
Cross-project response reuse makes audit evidence unsafe to sum. Canonical HTTP
bodies cannot authorize this private source. For authoritative runs, Codex OTEL
remains non-additive metadata regardless of arrival order or future IDs.

Only observed nonnegative safe-integer usage fields count. The provider's total
is preserved, never reconstructed. Cache-read tokens are a subset of input and
reasoning tokens a subset of output: do not add those subsets again, including
by summing all `sgsd_atlas_request_tokens_total` token-type series. Missing
optional cache-write stays null. `runtime.model` is explicitly the returned
thread configuration, not the actual served per-response model; response model
and unverified current CLI version remain unknown. A resumed thread's creation
CLI version is not the current runtime version.

Health exposes `native_responses` separately from HTTP `native_requests`; audit
likewise separates response and request counts. Completed responses before a
later worker failure/interruption remain eligible, without declaring that worker
successful. Bounded polling/finalization, file checks, queue/index limits and
spool failures can leave partial capture. Content-free gaps remain in registered
global project/root evidence. No observation means unknown, not zero;
`complete_coverage` stays false. Windows rollout capture is OPEN_REQUIRED and
does not select this Linux-only authority. `SGSD_ATLAS_DISABLED=1` skips capture.

An operator prompt for the weekly check:

> Run the installed Atlas read-only audit across all registered projects and
> sessions. Report integrity failures, missing or stale provider capture,
> rejected or duplicate data and quota limitations. Cite the report's evidence;
> do not treat missing data as zero, sum account quotas across projects, or claim
> full coverage from launcher health alone. Do not modify evidence or restart
> running sessions.

`SGSD_ATLAS_DISABLED=1` disables capture for a launch. An empty file named
`disabled` in the global root stops the owned receiver and disables future
attachment; remove that marker to allow the next launch to start it again.
`SGSD_ATLAS_GLOBAL_ROOT` explicitly selects a different private root. Bootstrap
failure does not block SGSD: telemetry is switched off for that launch and a gap
is recorded where storage is available. The audit surfaces that degradation.

Receiver replacement applies its caller deadline to health checks, exact process
and listener verification, port-occupancy scans and launch. A timed-out transition
keeps its durable journal at the last completed boundary and requires an explicit
retry; expiry never authorizes signalling a process or starting a replacement.
Deadline checks cannot preempt a synchronous operating-system call already in
progress, so return latency can include the current synchronous operation; the
next boundary is checked before signalling, spawning or transferring startup
ownership.
Offline `codex-exec.sh --self-test --skip-network` diagnostics isolate their fake
workers from inherited Atlas roots and do not append parent-project metrics.

The automatic service bounds payloads, its working indexes (eight resident
project stores), per-project native canonical capacity (128 MiB), operational
canonical capacity (256 MiB), operational receipts (256 MiB), private capture
state (8 MiB), 64 KiB receipt batch lines, and process memory
(256 MiB V8 heap; shutdown above 512 MiB RSS). Capacity exhaustion stops detail
capture with a gap; canonical evidence is never pruned. Registrations and
canonical history accumulate, so monitor disk capacity. Limits in the optional
Collector/Prometheus stack below do not apply to this lighter automatic service.

## Optional legacy project stack

The remaining sections describe the earlier, separately opt-in Linux
Collector/Prometheus deployment. It remains available; its existing data is not
migrated or combined with automatic ledgers. `config/telemetry-atlas.json`'s
`enabled: false` belongs to this legacy stack, not the new automatic launcher
default. Use a single accounting source when analysing overlapping captures.
Neither deployment claims a comparison baseline, complete quota accounting,
or the later correlation/reporting milestones.

### Legacy installation and lifecycle

Linux x86-64 with Node 22+ and GNU tar is the initial supported runtime. Run the
explicit installer against a private absolute state directory, then use the
lifecycle command's explicit enable/start operations. Installation alone does
not enable or start any process. Repository updates and SGSD launch do not
download binaries.

The project hook dependency closure delivers only modules needed by registered
hooks; it does not deliver every Atlas CLI. The explicit global SGSD installer
copies the complete self-contained Atlas directory to
`~/.claude/tools/telemetry-atlas`, beside the global statusline hook, and beside
the nested worker at `~/.claude/super-gsd/tools/telemetry-atlas`. Use that
installed directory, or the authoritative canonical source directory's
`super-gsd/tools/telemetry-atlas`, for CLI operations. The lifecycle default state
path includes the first 16 characters of the project directory digest, so
independent projects do not share installation state.

```sh
ATLAS_PROJECT_DIR="$PWD"
ATLAS_TOOL_DIR="$HOME/.claude/tools/telemetry-atlas"
ATLAS_SOURCE_DIR="$HOME/.claude/super-gsd/source"
ATLAS_STATE_DIR="$(node -e 'process.stdout.write(require(process.argv[1]).parse(["node", "atlas", "status", "--project-dir", process.argv[2]]).stateDir)' "$ATLAS_TOOL_DIR/lifecycle.cjs" "$ATLAS_PROJECT_DIR")"
export SGSD_ATLAS_STATE_DIR="$ATLAS_STATE_DIR"
node "$ATLAS_TOOL_DIR/stack.cjs" install \
  --state-dir "$ATLAS_STATE_DIR" --project-dir "$ATLAS_PROJECT_DIR"
node "$ATLAS_TOOL_DIR/lifecycle.cjs" enable \
  --state-dir "$ATLAS_STATE_DIR" --project-dir "$ATLAS_PROJECT_DIR" --json
node "$ATLAS_TOOL_DIR/lifecycle.cjs" start \
  --state-dir "$ATLAS_STATE_DIR" --project-dir "$ATLAS_PROJECT_DIR" --json
node "$ATLAS_TOOL_DIR/lifecycle.cjs" status \
  --state-dir "$ATLAS_STATE_DIR" --project-dir "$ATLAS_PROJECT_DIR" --json
# Operational rollback preserves canonical telemetry evidence and inert binaries:
node "$ATLAS_TOOL_DIR/lifecycle.cjs" disable \
  --state-dir "$ATLAS_STATE_DIR" --project-dir "$ATLAS_PROJECT_DIR" --json
```

Legacy-only launchers used an exported `SGSD_ATLAS_STATE_DIR` for their health
check. Updated standard launchers prefer automatic capture and replace inherited
run settings; exporting the legacy state directory does not select that stack.
Explicit `--state-dir` overrides
must be supplied consistently to every lifecycle command. Production activation
is a separate operator step after tests and project install provenance pass.
When using the existing `sgsd-remote-tmux.sh` launcher, pass
`--source-dir "$ATLAS_SOURCE_DIR"` so framework provenance is checked against the
authoritative canonical source and the target project's existing install pin.
Do not substitute a project-local partial hook tree as the framework source.

Use the lifecycle manager for project-specific state directories, owned process
identity, explicit enable/disable, launch health gating, and rollback. Do not
start additional copies with the defaults. An occupied port is a refusal to
activate telemetry; it is never authority to stop the existing listener.
`processSpecs({stateDir, projectDir, ports})` accepts explicit port overrides for
isolated verification or an approved alternate configuration. It never chooses
fallback ports silently.

The pinned binaries are official [Collector Contrib 0.160.0](https://github.com/open-telemetry/opentelemetry-collector-releases/releases/tag/v0.160.0)
and [Prometheus 3.14.0](https://github.com/prometheus/prometheus/releases/tag/v3.14.0).
Their committed archive SHA-256 values were compared with the official release
checksum assets on 2026-09-07. Downloads use fixed HTTPS release URLs, restricted
GitHub asset redirects, a byte limit and timeout. The archive hash is checked
before extracting only the named executables. `install --archive-dir /absolute/cache`
supports an explicit offline cache with the original release archive filenames;
the same committed checksums remain mandatory and no network fallback occurs.
Both releases are staged and validated before the executable directory is
published, so download/checksum/configuration failure leaves no executable
installation behind. Installation records binary
hashes; runtime specification generation verifies them again. The real binaries
validate both generated configurations before an installation witness is written.
No binary is committed to the repository.

## Local flow and privacy boundary

| Endpoint | Owner and purpose |
| --- | --- |
| `127.0.0.1:4318` | Official Collector OTLP HTTP receiver |
| `127.0.0.1:4319` | SGSD normalizer, sanitized OTLP JSON |
| `127.0.0.1:13133` | Collector health |
| `127.0.0.1:13134` | Normalizer health and process identity |
| `127.0.0.1:9464` | Collector's bounded native metric projection |
| `127.0.0.1:9465` | Normalizer's bounded accounting and coverage projection |
| `127.0.0.1:9466` | Collector's internal queue and failure counters for lifecycle monitoring |
| `127.0.0.1:9090` | Prometheus UI and query API |

Collector transforms run before memory limiting, batching, persistent queues,
and file output. They retain only reviewed attribute keys and validate scalar
types and patterns. The body is used only to recognize a fixed native event
name and is then emptied. Unknown attributes, nested maps in scalar fields,
prompt/tool/error bodies, account/email/host/process attributes, scope metadata,
schema URLs, severity text and metric descriptions are removed before disk.
Traces have no pipeline. Metrics strip all resource attributes and retain only
finite model-family and token-type dimensions. Exemplars lose their attributes
and correlation IDs. Session/request/run/repository IDs are never metric labels.

Collector diagnostics go to `/dev/null`, including its internal error sink,
because transform/decode diagnostics can include untrusted input. Operational
health and gap evidence come from the lifecycle manager and normalizer. There
is no debug exporter, external destination, remote write, account query, or
global provider configuration. Private directories use mode `0700` and written
configuration/witness files `0600`; the lifecycle process must set umask `0077`
before starting child binaries so their generated files inherit private modes.

## Limits and their enforcement

The sanitized log spool uses Collector's file rotation: 16 MiB per file, 31
backups plus the active file, and seven-day rotation retention. Its total
configured rolling capacity is 512 MiB. Sanitized native logs and metrics both
enter this disposable spool; metrics also reach the bounded scrape exporter.
Inactive-file expiry is performed only when Collector rotates; lifecycle
housekeeping is required for a strict wall-clock cutoff while ingestion is idle.
The canonical `.planning/metrics` ledger is separate and is never rotated or
deleted by this component.

Collector uses two persistent signal databases, each with a hard 128 MiB
`file_storage.max_size` limit, totaling at most 256 MiB. Each signal queue has a
64 MiB serialized-payload limit, one consumer and no blocking on overflow.
Compaction is disabled to avoid extra temporary databases. A full queue rejects
telemetry. Retries stop after 24 hours for an actively retried batch. This is
**not** a disk-record age TTL: queue waiting time and restarts require lifecycle
age monitoring and an explicit degradation/gap when the 24-hour window expires.
The queue is disposable; canonical evidence is not.

Prometheus retains blocks for 35 days or 2 GiB, enables WAL compression, and
limits scrape size, samples, labels, concurrent queries and query samples.
[Prometheus retention](https://prometheus.io/docs/prometheus/latest/storage/)
does not provide an instantaneous filesystem quota: WAL/head data and compaction
need separate headroom. The configuration reserves a further 512 MiB for the
runtime monitor to account for. No retention operation targets project evidence.

Collector's memory limiter rejects data near 224 MiB of Go heap and its
`GOMEMLIMIT` is 192 MiB. Prometheus's Go heap target is 384 MiB. These are soft
heap controls, **not kernel-enforced RSS limits**. Lifecycle monitoring must
observe RSS (Collector 256 MiB, Prometheus 512 MiB), queue/spool age, total disk
usage and the 10% free-space floor, stopping only verified owned telemetry
processes and recording the gap when limits are exceeded. A deployment without
that monitor is degraded and cannot claim the design's resource acceptance.
The collector's 2% rolling CPU budget is a calibration acceptance measurement,
not a CPU throttle in this configuration.

## Verification

```sh
node super-gsd/tools/telemetry-atlas/run-self-test.cjs
# Automatic capture, audit, launch helpers and real isolated global installation:
node super-gsd/tools/telemetry-atlas/run-self-test.cjs --task T4
node --test super-gsd/tools/telemetry-atlas/stack.test.cjs
# Explicit downloads and isolated listeners; use only a disposable Linux fixture:
SGSD_ATLAS_REAL_STACK_TEST=1 node --test super-gsd/tools/telemetry-atlas/stack.test.cjs
```

The real-stack case installs official binaries, validates both configurations,
starts them on separate fixture ports, sends malicious nested fields and schema
URLs plus malformed OTLP, and checks canonical normalizer intake, spool, metrics
and captured diagnostics for the privacy canary. It queries the real Prometheus
TSDB and requires distinct input and output token series. This is a recorder test; its fake
tokens are not workload/economics evidence.

Configuration behavior follows the pinned [transform processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/v0.160.0/processor/transformprocessor),
[file exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/v0.160.0/exporter/fileexporter),
[file storage extension](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/v0.160.0/extension/storage/filestorage),
and [Prometheus exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/v0.160.0/exporter/prometheusexporter).
Provider upgrades and new attributes require a reviewed allowlist change.
