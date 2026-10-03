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
- Adds TurnSync policy controls for `ON | OFF | ASK` and `full_turns | decisions_tasks | summaries`. When Core-auth is connected, the visible control reads/writes the authenticated **account default** through the runtime policy API with explicit Save + CAS. Without Core-auth, the select values remain browser drafts only; changing a select never silently uploads anything.
- Adds bounded **JEV next-action** scoring. JEV receives explicit action candidates and `kind:"next_action"`; it is not presented as a free-form conversation summarizer.
- Adds pure TurnSync helpers + Node tests for policy, normalization, append-turn arguments, search/digest behavior, and JEV boundaries.

## Existing runtime contracts used

- `cairnstone_unified_conversations` — preferred authenticated account aggregate on the companion runtime feature branch.
- `cairnstone_conversation_session_list` — legacy actor-scoped fallback when authenticated aggregation is unavailable.
- `cairnstone_conversation_session_get`
- `cairnstone_turnsync_append` — replay-safe authenticated, standing-policy-gated end-of-turn bridge on the companion runtime feature branch.
- `cairnstone_turnsync_policy_get` / `cairnstone_turnsync_policy_set` — authenticated operational policy read + human-confirmed CAS write.
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

The helper `buildAppendTurnArgs` remains useful for the low-level compatibility path. The preferred provider path is now `cairnstone_turnsync_append`, which constrains actor identity to the authenticated connection, makes exact duplicate turn/message identities replay-safe, and derives standing-policy scope from the target Conversation Session.

Policy precedence is workspace → chain → account → safe default ASK. `OFF` blocks. `ASK + full_turns` requires an explicit one-turn `sync_confirmed:true` marker supplied after host/UI human confirmation. `ON + full_turns` permits the append. `decisions_tasks` and `summaries` fail closed until trusted payload transformers exist; the bridge never silently substitutes raw full turns. None of these paths grants accepted-state authority.

## Important boundary: authenticated operator aggregation

A companion runtime feature branch now implements `cairnstone_unified_conversations`. It derives the visible actor/provider set server-side from the authenticated Core account's active connections, reuses the existing membership/recipient-aware read paths, de-duplicates correlated Conversation Sessions, AC1 threads, Task Runs, and event projections, and retains `visible_via[]` provenance.

The Console prefers that aggregate and does **not** use the editable Actor ID to widen account visibility. If the runtime is older or the Console is still using legacy unauthenticated `/mcp`, it falls back to `cairnstone_conversation_session_list` for the configured actor and labels that fallback.

The Console feature branch now includes a public-client Core-auth PKCE S256 flow against `/mcp/core-auth`. It uses a static CIMD document (`oauth-client-metadata.json`), keeps access/refresh tokens in `sessionStorage` only, rotates the refresh token on expiry/401, and explicitly revokes/clears the browser session on disconnect. The legacy `/mcp` path remains available and unchanged.

For TurnSync policy, Console intentionally edits only the authenticated **account default** in this slice. The runtime already supports workspace and chain policy rows, and those may override the account default for a bound Conversation Session. The Console loads the current account policy, shows server revision/default status, requires an explicit `Save account policy` click (`human_commit:true`), supplies `base_revision` for updates, and reloads on a CAS conflict. LocalStorage is only a draft/fallback, never standing authorization.

This is still **feature-branch implementation, not an end-to-end live proof**: the CIMD document is served from the GitHub Pages Console origin and is not reachable from the branch until that Console version is published. Therefore the account aggregate is code-wired with a real auth path, but production OAuth/aggregate canary remains a deployment-time gate.

## Synthesis path

Two different jobs must stay separate:

1. **Conversation synthesis** — summarize/compare the actual bounded turn set. This needs a provider-neutral bounded conversation pack + model synthesis contract (or another grounded runtime primitive) because Conversation Sessions are operational context, not accepted chain evidence.
2. **JEV scoring** — rank explicit next-action candidates (`ask_jev`, `kind:"next_action"`). JEV should help choose who/what to do next, not fabricate a prose summary role it does not have.

The first slice ships deterministic digest + JEV next-action scoring and leaves model synthesis for the next runtime slice.

## Next build slices

1. **Core-auth Pages + migration canary**: publish/test the CIMD + PKCE flow, apply the Auth D1 TurnSync-policy migration under explicit deployment authorization, verify refresh rotation/revoke, and exercise policy get/set plus `cairnstone_unified_conversations` with no cross-account leakage.
2. **TurnSync policy canary**: verify account/workspace/chain precedence, OFF/ASK/ON behavior, one-turn confirmation, stale CAS, exact replay, and projection-incomplete fail-closed behavior.
3. **Trusted selective-payload transforms**: implement bounded `decisions_tasks` and `summaries` transformation before either mode can auto-append.
4. **Provider/host end-of-turn integration**: call `cairnstone_turnsync_append` after eligible user/assistant turns. Prompt/instruction-driven calls are interim; deterministic host lifecycle hooks are preferred where providers expose them.
5. **Bounded conversation synthesis**: normalize a selected group into a provider-neutral pack and produce summary/compare/blocker/next-step outputs with provenance.
6. **Dispatch from the grouped view**: reuse existing AC1/Task Run controls to message one actor, a selected subset, or all relevant actors.
7. **Mobile Messages convergence**: user-to-user and agent-to-agent message threads appear in the same conversation graph when policy allows.

## Acceptance criteria for 10j first slice

- Existing Inbox/Handoff/Activity surfaces remain reachable.
- Conversations appears as a fourth communications sub-surface.
- No accepted-state mutation is introduced.
- Exact identities are preserved; no actor is inferred from role/provider labels.
- Empty/loading/error states are honest.
- TurnSync + Core-auth helper tests are present, including standing-policy enforcement and authenticated-Core vs legacy-Core exposure boundaries; the current feature-branch checkpoint distinguishes syntax/static validation from an actual Node test-suite run.
- Core-auth browser tokens are session-local, are never reused as operator tokens, and do not become accepted-state authority.
- JEV is labeled and invoked only as a scorer/router for next actions.
