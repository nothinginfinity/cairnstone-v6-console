# V7.7.8c — Console Answer Depth UX

**Status:** Console implementation slice (this repo).  
**Worker contract (live):** V7.7.8a/b on `nothinginfinity/cairnstone-v6` tip `dabe87e0…`, worker **0.5.37**.  
**Activation gate:** project-memory stone `32fec8664ec508c2362e33898a6db46681e3deb070b2c3b71a6a76870f13406f`.  
**Canonical product docs (worker):** `docs/V7_7_8_PROGRESSIVE_GROUNDED_CHAT_LOD.md`, `docs/V7_7_8A_GROUNDED_RESPONSE_CONTRACT.md`.

## What this slice owns

Wire Console Chat to the grounded-response contract and **Answer Depth** UX:

- default chat cards are compact and mobile-first;
- create via `cairnstone_grounded_response` at **`response_lod: 1`**;
- deeper levels lazy-expand the **same** `response_id` via `cairnstone_grounded_response_expand` / `get`;
- LOD controls `[LOD 1] [2] [3] [4] [5]` on every grounded response;
- authority / evidence strip (`Authority: Current ✓` / Stale / Original snapshot + evidence ref count);
- natural-language Answer Depth commands;
- per-thread / per-Code-Session **presentation** default depth;
- stale expand → distinct **View original snapshot** vs **Refresh answer** actions.

## Naming (non-negotiable)

| Field | Meaning |
|---|---|
| `response_lod` | Human answer depth **1 → 5** (Console may label **LOD** / **Answer Depth**) |
| `stone_lod` | Storage retrieval **lod5 → lod1** — **unchanged**, never overloaded in Chat UI copy |

## Authority

Every grounded response carries `accepted_state_authority: false`. The Console grants **no new authority**.

Presentation defaults (thread / Code Session Answer Depth) live only in browser storage:

- `localStorage['cs.answerDepth.v1']` — `{ threadDefaults, codeSessionDefaults }`
- `localStorage['cs.chatThreadId.v1']` — stable Console chat thread id for thread defaults
- Code Session id is read from existing `sessionStorage['cs.codeSessionId']` (V7.7.7f)

These defaults **never** become accepted project truth and **never** mutate chain/path HEADs.

## Chat routing

| Mode | Tool | Notes |
|---|---|---|
| Default (single or multi Scope) | `cairnstone_grounded_response` (+ expand/get) | Owns progressive Answer Depth for Chat answers |
| Optional single-chain tool delegation | `cairnstone_delegate` | Checkbox on Chat; preserves V7.7.3 tool path; LOD controls inactive |
| Code / Invite / Authorize / etc. | unchanged | V7.7.7f / V7.7.6 surfaces not redesigned (V7.7.9 out of scope) |

Multi-chain Chat no longer calls unconstrained `cairnstone_ask_scope` on the default path; grounded-response composes the same Scope selectors.

## Natural-language commands

Parsed client-side in `answer-depth.js` before create:

- `LOD 3 that.` / `Give me the LOD 5 version.` → expand last `response_id`
- `Keep this conversation at LOD 1 unless I expand.` → set thread presentation default
- `Use LOD 2 by default for this Code Session.` → set Code Session presentation default (requires Code Session id)

If a presentation default is `> 1`, Console still **creates at LOD 1**, then expands the same `response_id` to the preferred depth (lazy, no silent authority refresh).

## Stale semantics

When expand fails with `stale_response` / `authority_changed`:

1. **View original snapshot** → expand with `view_original: true` (same `response_id`)
2. **Refresh answer** → create with `refresh_of=<old response_id>` → **new** `response_id`

Never auto-refresh in a way that discards the snapshot the user was reading.

## Files

- `answer-depth.js` — parsers, presentation storage, strip/stale helpers
- `answer-depth.test.js` — Node unit tests (`node --test answer-depth.test.js`)
- `app.js` / `index.html` / `styles.css` — Chat wiring + compact LOD UI
- This doc

## Out of scope

- V7.7.8d cross-provider / richer stale acceptance polish
- V7.7.9 whole-Console redesign
- Worker contract changes

## Smoke notes

Live MCP (optional, not required for unit tests):

1. Resolve default Scope (`cairnstone-v6-project-memory`).
2. Ask a short question → expect `cairnstone-grounded-response-v1` at LOD 1 with LOD buttons.
3. Tap `3` → same `response_id`, deeper text.
4. If authority moved → stale strip + View original / Refresh.
5. Type `Keep this conversation at LOD 1 unless I expand.` → defaults line updates; no stone write.
