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

- `cairnstone_unified_conversations` — preferred authenticated account aggregate on the companion runtime feature branch.
- `cairnstone_conversation_session_list` — legacy actor-scoped fallback when authenticated aggregation is unavailable.
- `cairnstone_conversation_session_get`
- `cairnstone_turnsync_append` — replay-safe authenticated end-of-turn bridge on the companion runtime feature branch.
- low-level compatibility primitive: `cairnstone_conversation_session_append_turn`
- optional scorer: `ask_jev`

Conversation history remains operational state:

- `accepted_state_authority:false`
- no chain/path HEAD mutation
- no synthetic global HEAD
- no automatic promotion to project memory

## TurnSync ingestion contract

The provider-side bridge should append eligible turns with stable identities. The new `cairnstone_turnsync_append` bridge owns the Conversation Session revision/CAS retry mechanics server-side, so provider hooks do not supply `base_revision`:

- `conversation_id`
- `turn_id`
- `message_id`
- `role`
- `turn_type`
- exact `actor_id` (runtime stores this from the caller/turn context)
- bounded `content_preview` and/or `content_ref`
- `response_ids`, `tool_receipt_refs`, `attachment_refs`, `object_refs`, `task_run_ids` when relevant
- routing/intent metadata only when explicit

The helper `buildAppendTurnArgs` remains useful for the low-level compatibility path. The preferred bootstrap provider path is now `cairnstone_turnsync_append`, which constrains actor identity to the authenticated connection and makes exact duplicate turn/message identities replay-safe. It does not grant accepted-state authority.

## Important boundary: authenticated operator aggregation

A companion runtime feature branch now implements `cairnstone_unified_conversations`. It derives the visible actor/provider set server-side from the authenticated Core account's active connections, reuses the existing membership/recipient-aware read paths, de-duplicates correlated Conversation Sessions, AC1 threads, Task Runs, and event projections, and retains `visible_via[]` provenance.

The Console prefers that aggregate and does **not** use the editable Actor ID to widen account visibility. If the runtime is older or the Console is still using legacy unauthenticated `/mcp`, it falls back to `cairnstone_conversation_session_list` for the configured actor and labels that fallback.

The static Console does not yet establish a Core-auth/OAuth session against `/mcp/core-auth`, so the account-wide aggregate is wired but not yet available end to end in the current undeployed branch.

## Synthesis path

Two different jobs must stay separate:

1. **Conversation synthesis** — summarize/compare the actual bounded turn set. This needs a provider-neutral bounded conversation pack + model synthesis contract (or another grounded runtime primitive) because Conversation Sessions are operational context, not accepted chain evidence.
2. **JEV scoring** — rank explicit next-action candidates (`ask_jev`, `kind:"next_action"`). JEV should help choose who/what to do next, not fabricate a prose summary role it does not have.

The first slice ships deterministic digest + JEV next-action scoring and leaves model synthesis for the next runtime slice.

## Next build slices

1. **Authenticated Console session**: wire the static Console to Core-auth/OAuth so `cairnstone_unified_conversations` can run with server-derived account identity rather than falling back to one actor.
2. **Standing TurnSync policy**: make project/workspace `ON | OFF | ASK` and payload mode deterministic/auditable. The replay-safe append bridge intentionally returns `sync_policy_evaluated:false` until this exists.
3. **Provider/host end-of-turn integration**: call `cairnstone_turnsync_append` after eligible user/assistant turns. Prompt/instruction-driven calls are interim; deterministic host lifecycle hooks are preferred where providers expose them.
4. **Bounded conversation synthesis**: normalize a selected group into a provider-neutral pack and produce summary/compare/blocker/next-step outputs with provenance.
5. **Dispatch from the grouped view**: reuse existing AC1/Task Run controls to message one actor, a selected subset, or all relevant actors.
6. **Mobile Messages convergence**: user-to-user and agent-to-agent message threads appear in the same conversation graph when policy allows.

## Acceptance criteria for 10j first slice

- Existing Inbox/Handoff/Activity surfaces remain reachable.
- Conversations appears as a fourth communications sub-surface.
- No accepted-state mutation is introduced.
- Exact identities are preserved; no actor is inferred from role/provider labels.
- Empty/loading/error states are honest.
- TurnSync helper tests are present; the current feature-branch checkpoint distinguishes syntax/static validation from an actual Node test-suite run.
- JEV is labeled and invoked only as a scorer/router for next actions.
