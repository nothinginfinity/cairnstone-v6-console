# CairnStone V7 Console

A thin, provider-neutral browser client for the live CairnStone V7 runtime.

## V7.7.9d Universe v2

**Universe** is a semantic-zoom projection (Vault → Repo → Chain → Intelligence) over the same Scope selectors as the context bar. Spatial, list, and grid views share one entity set; search focuses without mutating accepted state; Intelligence LOD loads one bounded orientation card via existing read APIs. Presentation only — no synthetic graph edges or Console authority. See `docs/V7_7_9D_UNIVERSE_V2.md`.

## V7.7.9c Work + communications

**Work** is the task-oriented home for Code Session (V7.7.7f console-view): current task first, then progressive disclosure for actors, tests, working tree, checkpoints, environment/sandbox, and an action catalog bound to existing APIs only. **Inbox** deepens into a communications hub (Inbox · Handoff · Activity) with shared list/thread patterns and clear intent labels while preserving AC1 identity and zero execution authority from correspondence. See `docs/V7_7_9C_WORK_COMMUNICATIONS.md`.

## V7.7.9b Chat + contextual evidence

Chat is the grounded-chat home on the 9a shell: Answer Depth stays prominent; provider/model and related runtime knobs live in a **Chat config** sheet; grounded answers open an **Evidence** drawer bound to the same `response_id`. Presentation only — no new accepted-state authority. See `docs/V7_7_9B_CHAT_CONTEXTUAL_EVIDENCE.md`.

## V7.7.9a Responsive shell

Primary navigation is **Chat · Work · Universe · Inbox · More** (mobile bottom nav + desktop rail), with a compact context bar for Scope / actor / session / runtime. Dense 9-peer-tab chrome is gone; capabilities remain reachable via primary destinations and Inbox/More subnav. Presentation only — no new accepted-state authority. See `docs/V7_7_9A_RESPONSIVE_SHELL.md`.

## V7.7.8c Answer Depth

Chat answers default to progressive **Answer Depth** (`response_lod` 1→5) via `cairnstone_grounded_response*`:

- compact LOD 1 cards by default; deeper levels expand the same `response_id`;
- LOD controls, authority/evidence strip, and stale **View original** / **Refresh** actions;
- NL commands such as `LOD 3 that.` and per-thread / per-Code-Session presentation defaults (localStorage only — not accepted authority);
- optional single-chain **tool delegation** checkbox restores `cairnstone_delegate` when needed.

`response_lod` is never confused with Stone storage `stone_lod`. See `docs/V7_7_8C_CONSOLE_ANSWER_DEPTH.md`.

## V7.7.7f Persistent Code Mode

The **Work** primary (Code Session panel) is an operator surface for one durable Code Session (not a single model chat):

- loads `cairnstone_code_session_console_view` with `code_session_id`, `actor_id`, and a workspace capability entered into a password field (kept only in `sessionStorage`, never stoned);
- shows project, lifecycle, current task, actors, tests, and working-tree summary from the worker aggregation;
- **Invite Agent** switches to **More → Invite** and prefills workspace + continuation prompt — minting still uses the V7.7.6 trusted-human invite flow (`POST /v1/workspace-invites` / Mint & Send); no second ticket format;
- **Send Message** uses ordinary AC1 `cairnstone_send_message` with the continuation prompt;
- **Checkpoints** / **View Work** call existing list/tree APIs;
- **Propose / Merge** confirms, then calls only `cairnstone_workspace_propose_accept` (Console grants no new merge/deploy authority).

## V7.7.3 scope workspace

V7.7.3 turns the previous single-Chain Console into a shared multi-repository / multi-chain workspace while preserving CairnStone authority boundaries.

- one global **Scope** control (context bar → sheet) resolves the existing `cairnstone-scope-v1` selectors (`single_chain`, `repo`, `multi`, `vault`);
- the catalog comes from `cairnstone_vault_catalog`; the resolved authority snapshot comes from `cairnstone_resolve_scope`;
- list selection supports searchable repository grouping, child chains, explicit multi-select, recents, and `All CairnStone`;
- Chat uses progressive Answer Depth (`cairnstone_grounded_response`) by default; optional single-chain tool delegation keeps `cairnstone_delegate`;
- Evidence renders the exact resolved Scope identity plus citation/coverage evidence returned by the runtime;
- Stones uses single-chain listing when narrowed to one chain and `cairnstone_find_scope` for cross-Scope search;
- Handoff association is explicit: the human chooses one exact participating chain because AC1 handoffs carry one chain field;
- Inbox and Activity are deliberately **not** auto-filtered by Scope because compact correspondence listing metadata does not expose a trustworthy chain association;
- Bird’s Eye / Universe is a full-screen spatial projection of the same Scope selectors, with semantic zoom (Vault → Repo → Chain → Intelligence), search-to-focus, list/grid parity, explicit multi-select, and bounded LOD loading;
- spatial position, proximity, clustering, size, and animation are presentation only. They are never authority and never create graph edges;
- repository grouping shown in the projection comes from catalog provenance;
- no synthetic global HEAD is created. Every participating chain retains its own canonical chain HEAD and accepted path HEADs.

The console remains dependency-free and requires no WebGL. The Universe projection uses ordinary DOM/CSS so a usable list/grid fallback is always present.

## Existing trusted-human boundary

The V7.3.3 authorization surface remains intact:

- delegated models receive zero execution/mutation authority;
- pending mutation requests are reviewed in **Authorize** (under More);
- approval/denial uses REST-only operator endpoints deliberately absent from the MCP tool catalog;
- the operator bearer is entered by the human and kept only in browser `sessionStorage`;
- approval binds to the immutable request Stone, exact argument digest, and concurrency guard;
- execution accepts no replacement mutation arguments.

Default runtime: `https://cairnstone-v6.jaredtechfit.workers.dev/mcp`

The browser talks to the MCP endpoint directly over JSON-RPC.

## Run locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

Unit tests:

```bash
node --test answer-depth.test.js shell-nav.test.js chat-evidence.test.js work-surface.test.js comms-hub.test.js universe-v2.test.js
```

## Operator setup

Set a strong Worker secret named `CAIRNSTONE_OPERATOR_TOKEN` on `cairnstone-v6`. Do **not** put it in this repository or any model prompt. The human operator enters it in the Authorize tab for the browser session only.

## Authority model

The Console is a client, not a source of accepted state. Scope is navigation/retrieval context only. CairnStone chain/path HEADs remain canonical authority. AC1 handoff messages are immutable correspondence artifacts and transport intent only. Answer Depth presentation defaults are local UI state only.

The optional GitHub inbox mirror is transport-only. The browser sends only the target owner/repo/branch/path prefix to CairnStone; GitHub credentials remain server-side in the runtime. A mirror artifact records its AC1 stone hash and explicitly carries zero execution, mutation, external-mirror, or accepted-state authority.
