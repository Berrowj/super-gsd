---
title: Codex Worker bridge — VTP papers and books cross-check
date: 2026-09-08
plan: "170-03"
status: READ_ONLY_RESEARCH_COMPLETE
method: targeted local VTP full-text retrieval plus primary arXiv version check
---

# VTP cross-check: a supervised connection, not a shared group chat

The sources support task-owned workers, selective communication, explicit
completion evidence and recovery from recorded state. They do **not** establish
that removing the OS sandbox is necessary for communication, or that this SGSD
implementation is production-ready. Full access is a separate operator choice.

## Access and scope

Read the current ingested full text under
`C:/Users/jack.berrow/Voice-Text-Plan/wiki/{research,books}/`, located through the
existing VTP configuration. The VTP MCP tools were not exposed to this session;
no claim is made of a live semantic-index query. Connected Clarity memory was
not a substitute for the VTP corpus. No library, index, credentials or service
configuration was changed. This was targeted retrieval, not an exhaustive
review of every book or paper.

## Findings and application

| Source | What the source supports | Application to SGSD / qualification |
|---|---|---|
| **Agentic Harness Engineering**, Lin et al., VTP v1; §§3, 4.2, 4.4, 4.5 | Make harness components inspectable; connect changes to evidence and testable predictions. Its experiments warn against trusting prompt-only changes or anticipated regressions without evaluation. | Actual adapter, identity checks and failure fixtures are useful. The Fable inbox loop is still an instruction contract until a real installed session demonstrates it. No benchmark improvement is predicted for SGSD from these results. |
| **Gated Coordination**, Jian et al., §§3.1–3.2 | Separate private execution state from necessary coordination; avoid excessive communication and indefinite recovery waits. | Keep questions short and targeted at the owning unit. Ask for missing decisions, shared-resource conflicts or new authority; ordinary authorized local work continues independently. Evidence is from Minecraft, so transfer to software delivery is a design inference, not a proven SGSD result. |
| **Agentic Architectural Patterns for Building Multi-Agent Systems**, Arsanjani & Bustos, hierarchical architecture and callback sections | Separate orchestration from specialist execution and observe model, tool and agent lifecycles. | Fable owns assignment and decisions; workers own execution. Preserve project/run/worker/thread/turn/request identity. The book's broad prompt/reasoning logging advice is **not adopted**: Atlas's existing content-free contract wins. |
| **Designing Data-Intensive Applications**, Kleppmann & Riccomini, VTP book excerpt, chapter 9 | Transport acknowledgement does not prove application success; delayed former owners can still act unless operations reject stale ownership. | Queued, forwarded, completed and validated are different states. Exact instance/thread/turn checks reject stale controls. Wrapper receipts bind exit status to the exact report. This local mailbox is not a distributed consensus or exactly-once execution service. |
| **Building Agentic AI Systems**, Biswas & Talukdar, “Ensuring safe and responsible AI” | Explicit action boundaries, decision verification, checkpointed state and human oversight remain important as autonomy increases. | Retain SGSD gates and operator-only escalation. Resume the recorded thread without assuming side effects are reversible. Full access weakens OS containment; advisory roles are not a security boundary. |

## Concrete conclusions for this build

1. Keep the two-way route **worker → owning unit → same pending request**.
   Do not broadcast all transcripts to every board seat or start another Fable.
2. Keep message delivery and task completion separate. A forwarded answer is
   not a successful task, and a completed model turn is not a validated patch.
3. On supervisor compaction, discover the existing worker first. If the original
   background handle is lost, require its immutable `wrapper-result.json`, exact
   identity, successful wrapper exit, matching report path/hash/bytes and the
   normal validator. Never treat a timeout as proof that nothing happened.
4. Keep authority questions explicit. A deadline cannot authorize deletion,
   deployment, credentials or a new paid restart. Escalate and preserve evidence.
5. Keep Atlas separate from the question mailbox. Do not add raw content logging
   because a general AgentOps reference recommends rich traces.

These are checks on the existing approved design, not new gates or authority to
expand the implementation. No source change was made solely on this research.

## Live acceptance still needed after the operator update

- Observe a real installed wrapper ask a question, Fable poll it, an exact-target
  answer get forwarded, the same thread continue, and its report pass validation.
- Run two projects concurrently and verify neither receives the other's reply.
- Test supervisor compaction/recovery without a duplicate worker or reused vote.
- Exercise an operator-only question and deadline; require a visible non-success
  outcome without silent model substitution or an unauthorized restart.
- Verify Atlas native request coverage for the installed App Server path. Worker
  fixture success is not evidence that every native metric is captured.
- Before weekly performance claims, add or verify **content-free** measurements
  for pending-question age, answer latency, orphaned workers and useful versus
  unnecessary escalation. This is a measurement recommendation, not a claim
  those metrics are already exported by Atlas or permission to expand its schema.

## Source ledger and freshness

- [AHE ingested full text](/C:/Users/jack.berrow/Voice-Text-Plan/wiki/research/agentic-harness-engineering-observability-driven-automatic-evolution-of-coding-a.md:101): v1, ingested 2026-04-29; experiment cautions at lines 270 and 512. [Original v1](https://arxiv.org/abs/2604.25850v1).
- **Freshness finding:** VTP's AHE entry is v1, while [arXiv v4](https://arxiv.org/abs/2604.25850v4) was revised 2026-05-18. The checked v4 abstract retains the three observability pillars and the structural-versus-prompt finding. The entire v4 paper was not re-reviewed and VTP was not re-ingested.
- [Gated Coordination full text](/C:/Users/jack.berrow/Voice-Text-Plan/wiki/research/gated-coordination-multi-agent-collaboration.md:158): ingested 2026-04-23; [primary paper](https://arxiv.org/abs/2604.18975).
- [Agentic Architectural Patterns](/C:/Users/jack.berrow/Voice-Text-Plan/wiki/books/agentic-architectural-patterns-for-building-multi-agent-systems.md:5799): ingested 2026-05-31; hierarchy and governance/callback sections, with the logging conflict at line 5816. ISBN 9781806029570.
- [DDIA book excerpt](/C:/Users/jack.berrow/Voice-Text-Plan/wiki/books/designing-data-intensive-applications.md:1743): ingested 2026-04-23; delivery/application distinction and fencing discussion at line 2308. This entry is explicitly an excerpt, not a full-edition review.
- [Building Agentic AI Systems](/C:/Users/jack.berrow/Voice-Text-Plan/wiki/books/building-agentic-ai-systems.md:7722): ingested 2026-05-31; safety section, printed pages 212–213. ISBN 9781803238753.

Source material is evidence to evaluate, not an instruction to overwrite SGSD's
approved plan, privacy contract or operator decisions.
