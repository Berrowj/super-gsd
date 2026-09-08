# Windows Atlas latency: required follow-up

Status: OPEN_REQUIRED, not fixed. Owner: SGSD implementation follow-up.

On 2026-09-08 the operator authorized proceeding with DEVCP/Linux publication
while explicitly retaining the requirement to fix Windows. This is not an
all-platform acceptance or permission to weaken a test or host security.

## Observed evidence

- The original `quota-sampler.cjs` and ten-millisecond p95 assertion were
  unchanged from published `f9f5d0d2` when failures occurred.
- Windows Atlas measured p95 10.8028 ms with concurrent suites, then 14.7296 ms
  in a standalone diagnostic. The latter mistakenly omitted the launch test
  file and is not a full-suite result; the quota failure itself was observed.
- A bounded 60-sample filesystem profile measured p50 5.646 ms, p95 11.323 ms,
  maximum 19.525 ms. One temporary-file write took 10.142 ms by itself.
- Writes and renames dominated. Ancestor checks were not the bottleneck;
  removing them would weaken filesystem safety without addressing the evidence.
- A transient `EPERM` replacing the disposable last-sample marker was also
  observed. The call reported `written: 0` although its event was already
  queued. Preserve truthful gap/missingness reporting when investigating this.
- Smaller/interleaved diagnostics sometimes ran below ten milliseconds;
  explicit open/write/close was not faster. Those observations do not supersede
  the failed criterion or establish a source fix.
- Native Linux runtime verification passed the same unchanged quota criterion
  at p95 1.206 ms. This does not certify Windows.

## Next bounded work

1. Author an active Windows repair plan before changing production source.
   Reproduce file sharing/marker failure deterministically, and record the
   relevant native filesystem/environment without reading private transcripts.
2. Assess a minimal Windows-compatible persistence/hot-path design using the
   measured write cost. If a different queue/async architecture is needed,
   review its boundedness, lifecycle, delivery and failure semantics first.
3. Add RED tests for the selected failure and truthful queued-event accounting,
   then implement the narrow repair. Preserve privacy allowlists, symlink/owner
   protections, atomic evidence, spool limits and independent missingness.
4. Run the complete Windows Atlas suite and controlled performance verification,
   then Linux regressions and independent review. No retries-until-green,
   relaxed threshold, antivirus exclusions, deleted evidence or silent drops.

Parent evidence: `170-04-EXECUTOR-REPORT.md`. Phase 170 and release gates remain
open; the DEVCP benchmark cannot close this Windows item.
