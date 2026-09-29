# V7.7.10j — Unified Conversation Sync / TurnSync Console slice

Date: 2026-09-29
Status: first implementation slice

## Goal

Make the CairnStone Console the operator surface for cross-LLM conversation continuity instead of forcing the operator to reconstruct state from separate ChatGPT, Claude, Grok, Grok Bot, Perplexity, and Mobile Messages clients.

The first slice deliberately reuses live `cairnstone-conversation-session-v1` APIs rather than creating a parallel transcript database.

## What ships in this slice

- **Inbox → Conversations** surface in the existing communications hub.
- Lists Conversation Sessions visible to the current Console actor with exact `conversation_id`, status, revision, participant metadata, and stored-turn count.
- Loads one session with `cairnstone_conversation_session_get(..., include_turns:true)` and renders durable turns in causal order.
- Preserves exact `actor_id`, `turn_id`, and `message_id`; unattributed turns stay unattributed rather than being guessed.
- Shows a deterministic digest of stored metadata/previews, including selected actors who have no durable response turn yet.
- Adds local TurnSync policy controls: `ON | OFF | ASK` and `full_turns | decisions_tasks | summaries`. These controls are preferences only in this slice; they do **not** silently upload anything.
- Adds bounded **JEV next-action** scoring. JEV receives explicit action candidates and `kind:"next_action"`; it is not presented as a free-form conversation summarizer.
- Adds pure TurnSync helpers + Node tests for policy, normalization, append-turn arguments, search/digest behavior, and JEV boundaries.

## Existing runtime contracts used

- `cairnstone_conversation_session_list`
- `cairnstone_conversation_session_get`
- future provider bridge: `cairnstone_conversation_session_append_turn`
- optional scorer: `ask_jev`

Conversation history remains operational state:

- `accepted_state_authority:false`
- no chain/path HEAD mutation
- no synthetic global HEAD
- no automatic promotion to project memory

## TurnSync ingestion contract

The provider-side bridge should append eligible turns with stable identities:

- `conversation_id`
- CAS `base_revision`
- `turn_id`
- `message_id`
- `role`
- `turn_type`
- exact `actor_id` (runtime stores this from the caller/turn context)
- bounded `content_preview` and/or `content_ref`
- `response_ids`, `tool_receipt_refs`, `attachment_refs`, `object_refs`, `task_run_ids` when relevant
- routing/intent metadata only when explicit

The helper `buildAppendTurnArgs` validates the client-side shape and preserves the worker's CAS boundary. It does not grant authority.

## Important boundary: visibility vs global operator aggregation

Today `cairnstone_conversation_session_list` is actor-membership oriented. The Console therefore shows sessions visible to the actor entered in the context bar. A true operator-wide aggregate across all providers should be added as an explicit, policy-aware runtime read model rather than bypassing membership semantics in the browser.

That runtime aggregation is a follow-on slice and is the correct place to combine:

1. Conversation Session turns,
2. AC1/Messages thread correlation,
3. task/event state,
4. provider/source identity,
5. per-actor completion/blocker state.

## Synthesis path

Two different jobs must stay separate:

1. **Conversation synthesis** — summarize/compare the actual bounded turn set. This needs a provider-neutral bounded conversation pack + model synthesis contract (or another grounded runtime primitive) because Conversation Sessions are operational context, not accepted chain evidence.
2. **JEV scoring** — rank explicit next-action candidates (`ask_jev`, `kind:"next_action"`). JEV should help choose who/what to do next, not fabricate a prose summary role it does not have.

The first slice ships deterministic digest + JEV next-action scoring and leaves model synthesis for the next runtime slice.

## Next build slices

1. **Provider end-of-turn bridge**: project-scoped standing authorization and idempotent append after eligible user/assistant turns. Prompt/instruction-driven calls are an interim bridge; deterministic host lifecycle hooks are preferred where providers expose them.
2. **Operator aggregate read model**: one Console query that returns correlated Conversation Sessions + AC1/Messages threads across selected actors without weakening mailbox/session boundaries.
3. **Bounded conversation synthesis**: normalize a selected group into a provider-neutral pack and produce summary/compare/blocker/next-step outputs with provenance.
4. **Dispatch from the grouped view**: reuse existing AC1/Task Run controls to message one actor, a selected subset, or all relevant actors.
5. **Mobile Messages convergence**: user-to-user and agent-to-agent message threads appear in the same conversation graph when policy allows.

## Acceptance criteria for 10j first slice

- Existing Inbox/Handoff/Activity surfaces remain reachable.
- Conversations appears as a fourth communications sub-surface.
- No accepted-state mutation is introduced.
- Exact identities are preserved; no actor is inferred from role/provider labels.
- Empty/loading/error states are honest.
- TurnSync helper tests pass.
- JEV is labeled and invoked only as a scorer/router for next actions.
