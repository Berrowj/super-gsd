# P167 research — can a hook actually witness and bound a substrate call?

Read only. No file changes. Produce findings, not a plan.

## The question this phase turns on

P166 closed every Node substrate path at a validating gateway. Four
markdown-agent prompts keep the raw `mcp__vtp-kb__vtp_search_substrate` tool
because their runtime cannot inject a transport callback into Node `callVtp`.
Their compliance evidence is self-reported, so nothing witnesses the real
invocation, and an oversized response reaches agent context before any
truncation can apply.

Read `.planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/CONTEXT.md`
for the full framing, and `../166-substrate-call-filters/SUMMARY.md` DEFERRED-1
and `166-ADJUDICATION-REPORT.md` for what was already established.

Answer five things with evidence from this repository and from the Claude Code
hook contract. Where the answer depends on runtime behaviour you cannot execute,
say so and say what would settle it.

## 1. Can PreToolUse deny a specific MCP tool call?

Read the existing hook surface: `super-gsd/hooks/`, whatever registers it, and
the P146 session governance work. Establish concretely:

- Does a hook receive the resolved `tool_name` and the full `tool_input` for an
  MCP tool call, or a truncated form? P166's adjudication claimed the existing
  activity logger "truncates arguments". Verify that against the code.
- Can a hook block execution, or only observe? Name the exact mechanism and
  where it is documented or already used here.
- Does it see `mcp__vtp-kb__vtp_search_substrate` under that canonical name
  regardless of how the prompt referred to it?

## 2. Can PostToolUse alter what reaches agent context?

This is the decisive one for the F1 half. If a `PostToolUse` hook can only
observe the response after the model has already seen it, then per-hit capping
is impossible for raw prompt transports and this phase cannot close that half.

Do not guess. Find the contract. If it is genuinely unclear, say "unresolved"
and name the experiment that would settle it in one run.

## 3. How does a witness get correlated without creating a new self-report?

If a hook writes a witness row and the prompt separately reports a record, some
code must match them. Establish what stable identifiers exist to join on
(session id, tool-use id, payload digest) and whether they are available on both
sides. A correlation that depends on the agent reporting its own tool-use id
just moves the self-report up one level; say so if that is what you find.

## 4. What makes a hook tamper-evident here?

P147 made commit-seam gate activation tamper-evident. Read how. A hook an agent
can disable is a hook it can route around, and P166's whole lesson is that
unenforced instructions are not enforcement. Report what P147's mechanism
actually guarantees and whether it transfers.

## 5. Does the hook survive propagation to installed agents?

Two of the four surfaces are installed prompts written by
`super-gsd/tools/feature-propagation/audit.cjs` into a user profile. Establish
whether hook registration propagates with them, and what happens on a machine
where it is absent. Fail-open on a fresh machine would make the whole mechanism
decorative.

## Output

```
Q1_PRETOOLUSE_DENY: YES | NO | UNRESOLVED, with evidence
Q1_INPUT_FIDELITY: full | truncated | UNRESOLVED, with the file and line that shows it
Q2_POSTTOOLUSE_REWRITE: YES | NO | UNRESOLVED, with evidence or the settling experiment
Q3_CORRELATION_KEYS: <identifiers available on both sides, or the gap>
Q4_TAMPER_EVIDENCE: <what P147 guarantees and whether it transfers>
Q5_PROPAGATION: <survives | does not | UNRESOLVED, and the fail-open consequence>
BLOCKING_UNKNOWNS: none | <what must be settled before planning>
RECOMMENDED_SCOPE: <what P167 can honestly close, and what it cannot>
```

Then at most 400 words of supporting detail. Prefer naming files and lines over
describing them.
