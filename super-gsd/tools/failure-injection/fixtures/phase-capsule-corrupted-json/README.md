# Fixture: phase-capsule-corrupted-json

Scenario id: phase-capsule-corrupted-json
Target tool: super-gsd/tools/phase-capsule/write.cjs (readCapsule)
Inject mechanism: truncate_capsule_mid_write

## Failure mode

A truncated PHASE-CAPSULE.json (containing only the opening bytes of a
JSON document; mid-write truncation simulating a crash before fsync) is
written to:

  tmpdir/.planning/milestones/v1.8/phases/36-fixture/PHASE-CAPSULE.json

The harness then spawns a node -e wrapper that requires the real
write.cjs and calls:

  readCapsule(planningDir, 'v1.8', '36')

The real readCapsule (write.cjs:1208-1217) performs:
  1. capsulePath() resolution
  2. fs.existsSync() check
  3. fs.readFileSync(p, 'utf8')
  4. JSON.parse(txt)

Step 4 throws SyntaxError on the truncated input. The function is wrapped
in a Lock 13 try/catch (lines 1209/1214) that collapses the throw to a
`null` return. The wrapper observes `null` and surfaces it as the
load-bearing degraded sentinel.

## Closed-vocab observation

`expected_reason_codes` per scenarios.json:
`['capsule_parse_error']`.

The real readCapsule does NOT emit a closed-vocab reason on parse error
(the function returns `null` silently, mirroring the S1 token-attribution
implicit-skip pattern). The harness synthesizes `capsule_parse_error`
into observed_reason_codes when the structural assertion holds (corrupt
file present pre-call AND readCapsule returned null AND subprocess
exit_code === 0).

Structural assertion (load-bearing):
- subprocess exit_code is a number (real spawn proven; mock-predicate
  forbiddance per CONTEXT.md:81)
- wrapper.ok === true (wrapper reached completion path)
- corrupt_file_existed_at_call === true (inject step succeeded)
- capsule_result === null (Lock 13 degraded sentinel returned, no throw
  escaped readCapsule)

If readCapsule regresses to throw upward (Lock 13 violation) or returns
a partially-parsed object (silent corruption leak), the verdict flips
to FAIL.

## Files

- README.md (this file)
- seed-corrupted-capsule.json: a deliberately truncated JSON byte
  sequence (no closing brace; key with no value; mid-string break) that
  will reliably throw SyntaxError on JSON.parse

ASCII-only. No credentials.
