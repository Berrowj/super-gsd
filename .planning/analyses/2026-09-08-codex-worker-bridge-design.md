# Codex worker connection — approved direction, 2026-09-08

The operator approved the previously proposed two-way App Server connection and
explicitly requested that SGSD stop launching sandboxed Codex workers. Scope is
SGSD-owned dispatches, not the operator's global Codex installation/settings.

Use one host adapter per active worker, owning an App Server stdio connection.
Each dispatch has a project-bound UUID and retained Codex thread ID. The adapter
exposes a dynamic `sgsd_ask_orchestrator` tool and relays native user-input
requests. Fable and other orchestration units launch the existing wrappers in
the background, poll the project worker inbox, answer the exact worker/question,
and continue watching until the existing report/exit contract completes.

Host control supports status, reply, steering, interruption, and explicit
resume of a recorded worker's thread. No `--last`, automatic model substitution,
silent one-shot fallback, unsolicited Fable model call or remote listener.
Replies match project, worker, active turn and request; stale and duplicate
replies cannot answer another question. Unknown permission/connector requests
are refused, not answered as ordinary worker questions.

Worker mode uses `danger-full-access`, approval `never`, and retained sessions.
All shipped SGSD profiles and resolver fallbacks agree; old profile names remain
compatibility role names, not sandboxed binary variants. Existing allowed-file,
plan, verification, report, provider-circuit and release gates remain. Advisory
workers are instructed not to edit code, but without an OS sandbox this is a
workflow contract, not a security boundary. Full access exposes anything the
launching OS account can access. No global auth or profile edits are authorized.

Communication payloads live in private project operational state, not Atlas's
content-free ledger. Persist only bounded questions/replies and worker metadata;
do not copy raw App Server events, tool arguments, prompts, reasoning, auth data
or code into Atlas. Existing Atlas per-dispatch capture stays attached.

Alternative considered: NEEDS_INPUT plus one-shot resume is smaller but cannot
answer during a running turn. Disabling the sandbox alone does not connect the
orchestrator. The approved App Server adapter supports that interaction directly.

Verification uses isolated fake App Server processes and the real host adapter,
plus current CLI-generated protocol schemas and a no-model initialization smoke.
Test concurrency, wrong-project replies, stale/duplicate requests, nonzero turn
completion, disconnects, limits, timeout/cancel, retained resume and unchanged
wrapper report parsing. No paid provider calls or production deployment.

Protocol checked against local codex-cli 0.153.4 and
https://learn.chatgpt.com/docs/app-server. Dynamic tools are experimental;
unsupported versions fail explicitly instead of dropping the connection.
