# 98-11 Opus Board No Sonnet Plan

## Goal

Make SGSD deliberation routing unambiguously Sonnet-free by activating only Opus board members and preventing disabled board members from being resolved into dispatch rosters.

## Scope

- Patch `super-gsd/scripts/lib/board-registry.cjs` so `resolveRoster()` only returns dispatchable board members.
- Activate `sgsd-board-architect` and `sgsd-board-contrarian` as Opus board members.
- Keep `sgsd-board-pragmatist`, `sgsd-board-moonshot`, and `sgsd-board-researcher` disabled until explicitly reactivated.
- Regenerate `.planning/resource-registry/agents.jsonl`.

## Test-First Tasks

1. Add a failing `board-registry` regression test covering disabled default members and disabled escalation members.
2. Add a production-config assertion that the default board is Architect + Contrarian + CEO and no active board member uses Sonnet or Haiku.
3. Patch the resolver and board/agent frontmatter.
4. Run the board test, registry-sync test, registry regeneration, Sonnet-active audit, and `sgsd -NoOpen` preflight.

## Acceptance

- `boardRegistry.resolveRoster()` excludes any member whose `state` is not `active` or whose `model_default` is `disabled`, `sonnet`, or `haiku`.
- The default board resolves to `sgsd-board-architect`, `sgsd-board-contrarian`, and `sgsd-ceo`.
- Active runtime roster contains no `model:"sonnet"` or `model:"haiku"` rows.
- `sgsd -NoOpen` shows no active Sonnet agent group.
