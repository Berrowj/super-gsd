# Adversarial challenge: attack OPTION A before it is implemented. Read-only.

Read `.planning/milestones/v4.0-install-contract/phases/168-install-contract/168-BLOCKER-RECOVERY-BRIEF.md`
and the cited code. Your job is to BREAK the proposed decision, not to polish it.

Attack these specifically:

1. **Rollback completeness.** The journal covers publication of hooks/modules. Enumerate
   every write that can occur between journal 'committed' and the last rejection-capable
   step: settings.json merge, witness key provisioning, broker copy, `.codex/hooks.json`,
   grants. For each: is it rolled back, idempotently re-runnable, or harmlessly orphaned
   on a refused install? Name any write that would persist and matter.
2. **Crash windows.** Kill the installer between publication and rollback: what states
   can the project be left in, and does the journal's 'publishing'/'committed' state allow
   the NEXT install run to detect and heal each one? A state that requires manual repair
   is a finding.
3. **The smoke distinction.** The brief claims post-publication refusals are contained
   policy checks, unlike pre-write smoke. Is that true of EVERY refusal path at
   audit.cjs:797, 888-918, 935-937 and install.sh:484-500, 904? Any of them execute
   arbitrary code or mutate outside the journal's coverage?
4. **The behavioural guard.** Forced-refusal-then-byte-identity: can a future rejecting
   step evade it, e.g. one that refuses only on a state the fixture does not produce?
   Propose the minimal set of forced-refusal fixtures that makes evasion implausible.
5. **Is OPTION B actually safer?** Steelman prospective digests for one paragraph, then
   say which option you would ship and why.

End with exactly `CHALLENGE VERDICT: PROCEED`, `PROCEED-WITH-CHANGES` (numbered list), or
`REJECT` (with the alternative). ~15 shell commands. Max 500 words.
