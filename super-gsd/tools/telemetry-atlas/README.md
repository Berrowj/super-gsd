# SGSD telemetry Atlas capture foundation

Atlas is opt-in, local, content-free telemetry. It makes no model calls. This
increment provides capture and calibration; it does not claim a comparison
baseline, quota completeness, or the later correlation/reporting milestones.

## Installation and lifecycle

Linux x86-64 with Node 22+ and GNU tar is the initial supported runtime. Run the
explicit installer against a private absolute state directory, then use the
lifecycle command's explicit enable/start operations. Installation alone does
not enable or start any process. Repository updates and SGSD launch do not
download binaries.

The project hook dependency closure delivers only modules needed by registered
hooks; it does not deliver every Atlas CLI. The explicit global SGSD installer
copies the complete self-contained Atlas directory to
`~/.claude/tools/telemetry-atlas`, beside the global statusline hook. Use that
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

Keep `SGSD_ATLAS_STATE_DIR` exported when invoking the existing tmux launcher so
its health check uses the same installation. Explicit `--state-dir` overrides
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
