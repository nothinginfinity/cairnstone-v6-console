# V7.7.9b — Chat + contextual evidence integration

**Status:** Console implementation slice (this repo).  
**Baseline Console tip:** `37dc71b` (V7.7.9a IA + responsive shell, live-verified).  
**Worker contract (live):** **0.5.38** / V7.7.8d grounded-response (`cairnstone_grounded_response`, `_get`, `_expand`).  
**Canonical architecture (worker):** `docs/V7_7_9_CONSOLE_UX_ARCHITECTURE.md` — 9b slice.  
**Activation gate (project-memory):** `3461d91ee2f74b00f2503e8b705061e6a9ed8972ae6429c4c2d373c3657a3aa2` (`v779a-complete-live-verified`).

## What this slice owns

Presentation-only Chat polish on the 9a shell:

1. **Chat as grounded-chat home** — Ask + Answer Depth (LOD 1–5, NL commands, presentation defaults, stale View original / Refresh) remain fully wired and prominent.
2. **Contextual configuration** — Provider / model / temperature / inbox / output-token knobs move into a **Chat config** sheet (same sheet pattern as Scope / Runtime). First paint prioritizes question + answer + depth.
3. **Answer-linked evidence drawer** — From a grounded result card, open Evidence / provenance / receipt bound to the **same** `response_id` (citations, claims, authority freshness, envelope, LOD expand). Uses existing MCP get/expand payloads; no new worker APIs; no second authority graph.
4. **Capability honesty** — Single-chain optional `cairnstone_delegate` remains explicit; multi-chain / vault Scope blocks tool delegation with visible disabled state.

## Explicit non-goals (deferred)

- **9c** Work + communications consolidation
- **9d** Universe v2
- **9e** Saved Views
- **9f** Cross-device acceptance as its own slice
- Chain / path HEAD mutation; Console accepted-state authority

## Mapping table

| Goal | Console change | Authority note |
|---|---|---|
| Answer Depth on Chat | Unchanged contract wiring; depth defaults + LOD controls stay on Chat primary | `response_lod` ≠ `stone_lod` |
| Route / model declutter | Moved into `#chatConfigSheet`; Ask card opens via **Chat config** | Presentation only |
| Evidence from answer | `#evidenceDrawer` + `chat-evidence.js` model from grounded payload | Same `response_id` / skeleton |
| Single vs multi honesty | `chatConfigState()` + blocked tool-delegate checkbox | Never implies unsupported tools |
| 9a shell preserved | Chat · Work · Universe · Inbox · More; context bar; Work=Code; Inbox/More subnav; Authorize distinct | Client only |

## Files

- `chat-evidence.js` / `chat-evidence.test.js` — config + evidence-drawer helpers
- `app.js` / `index.html` / `styles.css` — Chat surface + sheets
- `shell-nav.test.js` — reachability + first-paint assertions
- This doc

## Baseline checklist (9b)

- [x] Chat first paint: Ask + Answer Depth defaults visible; provider/model not in primary card
- [x] Chat config sheet holds route/model / tokens / temp / inbox / refresh models
- [x] Evidence drawer opens from grounded card; sections bound to `response_id`
- [x] Multi-chain: tool delegation blocked + honesty copy
- [x] Stale View original / Refresh still wired
- [x] Presentation defaults localStorage-only
- [x] `accepted_state_authority` remains false (no Console writes of true)
- [x] 9a primary IA / nav / context bar preserved
- [x] `node --test answer-depth.test.js shell-nav.test.js chat-evidence.test.js` passes

## Tests

```bash
node --test answer-depth.test.js shell-nav.test.js chat-evidence.test.js
```

## Intentional follow-ons

- Live smoke of evidence drawer against a fresh grounded create/get with `include_evidence: true` (unit tests cover payload shaping).
- 9c Work/comms may deepen receipt linkage from Code Session without changing this drawer’s response_id binding.
- Optional: NL “show evidence” → open drawer (parser already reserved for ask/expand/defaults).
