# P167 planning revision 3, operator ruling on the round-2 NOGO

Revise `167-01-PLAN-LOCKED.md` IN PLACE as revision 3, with a provenance note in
the body. No source changes.

## The operator has ruled

Round 2 returned NOGO on one CRITICAL: the broker, its configuration, and the
private upstream manifest are all same-user-controlled, and the four
grant-bearing agents hold Bash and Write, so they can read the manifest, call
the upstream directly, restore another server definition, or replace the broker.

The reviewer named three closures: machine-managed policy, a different-principal
proxy, or removing raw access. All three need authority the current non-admin
operator does not hold, or cost more than the phase is worth.

**The operator has chosen to accept a bounded scope.** The reasoning, which the
plan should reflect: an agent with Bash and Write on this machine can already do
anything a user can do, so defending against a hostile agent at the MCP layer is
not winnable. The failure actually observed in practice, and the one that caused
this milestone, is agents forgetting to filter, taking shortcuts, or drifting,
not agents smuggling searches past a broker.

Do not treat this as permission to soften the language. It is the opposite: the
plan must now be precise about what it does and does not achieve.

## Required changes

1. **Reframe `intent` and every output_contract honestly.** The phase closes the
   drift, forgetfulness and shortcut cases; closes the deletion case, which
   round 2 confirmed is genuinely closed; caps oversized responses before the
   model reads them; and raises the cost of an unfiltered call from zero effort
   to deliberate circumvention. It does NOT defeat an agent with arbitrary
   same-user code execution. Say both halves in the intent, not just the first.

2. **Promote the residual from a dead-end note to a stated limit.** It should be
   visible in the intent and the summary-facing contract, not only in
   `known_deadends`. Anyone reading this plan in six months must not conclude
   the substrate path is sealed.

3. **Add an SAC that DEMONSTRATES the bypass rather than blocking it.** The
   reviewer asked for an SAC attempting alternate registration and direct
   Bash/stdio invocation. Under the bounded ruling, that test should assert the
   bypass SUCCEEDS and is recorded, not that it fails. Rationale: an untested
   admitted weakness drifts into a forgotten one, and a later reader will assume
   it was closed. A characterisation test pins the exact boundary, makes any
   future narrowing measurable, and makes overclaiming impossible.

   The SAC must name what the bypass proves: that a same-user actor with Bash
   can reach the upstream without a witness row. It must NOT be written as a
   failing or skipped test.

4. **Record the operator ruling** in the plan body with its date and reason, so
   the bounded scope reads as a decision rather than an oversight.

5. **Keep the T5 live evidence requirement.** The deletion-case proof from the
   fixture server's append-only log stays exactly as reviewed; round 2 called it
   adequate.

## Keep unchanged

Five tasks, the deny plus rewrite contract, session-plus-digest correlation with
no agent-supplied identifier, the broker's `tools/list` readiness check and
pre-forward `tools/call` recheck, the P166 regression set, and the honest
`local_hmac` trust wording. Six of seven round-2 checks passed; do not disturb
them.

Do not reduce task count or drop coverage. This revision changes claims and adds
one characterisation SAC; it does not shrink the build.

## Validate before finishing

```
node super-gsd/tools/plan-schema/validate.cjs \
  --plan-file .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-01-PLAN-LOCKED.md \
  --project-dir . --mode write
```

Exit 0 required. No emoji, no em dashes.

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max
120 words.
