# V7.7.9a — Information Architecture + Responsive Shell

**Status:** Console implementation slice (this repo).  
**Worker contract (live):** V7.7.8d on `nothinginfinity/cairnstone-v6` tip `a4ee851d…`, worker **0.5.38**.  
**Activation gate (worker):** project-memory hash `6443efc917a38df93521ab7a52747d1ac262ccdf8355a28a2fbafda8ac36b675` (`v778d-complete-live-verified`).  
**Canonical architecture (worker):** `docs/V7_7_9_CONSOLE_UX_ARCHITECTURE.md` on tip `a4ee851d`.  
**Baseline Console tip:** `f369f0c` (V7.7.8c Answer Depth).  
**Pre-change notes:** `docs/V7_7_9A_BASELINE_CHECKLIST.md`.

## What this slice owns

Presentation-only shell migration:

- Primary IA **`Chat · Work · Universe · Inbox · More`**
- Mobile **bottom navigation** + desktop **rail** sharing one semantic model
- Compact **context bar** (Scope / Actor / Session / runtime health)
- Scope + runtime editors moved into **sheets** (not permanent first-screen cards)
- Dense 9-peer-tab / 3×3 matrix removed
- Every previously supported capability remains reachable

## Explicit non-goals (deferred)

- **9b** Chat + contextual evidence deep redesign (Answer Depth stays as V7.7.8c inside Chat)
- **9c** Work + communications consolidation internals
- **9d** Universe v2 spatial redesign
- **9e** Saved Views + progressive disclosure everywhere
- **9f** Full cross-device acceptance as its own slice
- Framework rewrite; chain/path HEAD mutation; new Console authority

## Information architecture map

| Primary | Surfaces (reachable) | Notes |
|---|---|---|
| **Chat** | Ask / Answer Depth / grounded result | Landing surface; V7.7.8c unchanged |
| **Work** | Code Session panel (`panel-code`) | Label rename only; V7.7.7f behavior preserved |
| **Universe** | Universe landing + Bird's Eye overlay; Scope via sheet | Projection remains non-authority |
| **Inbox** | Inbox · Handoff · Activity (subnav) | AC1 contracts unchanged; nav consolidate only |
| **More** | Stones · Evidence · Authorize · Invite · Runtime | Authorize stays visually distinct as its own panel |

### Context bar

| Cue | Action |
|---|---|
| Scope | Opens Scope sheet (catalog / search / recents) |
| Actor | Opens Runtime sheet (MCP URL + actor id) |
| Session | Jumps to Work (Code Session) |
| Health | Opens Runtime sheet; recheck available there |

Raw MCP URL is **not** permanent first-screen chrome.

## Authority

- Console remains a **client** of CairnStone authority — no new accepted-state writes
- No silent merge of Chat / Work / Authorize authority
- Operator bearer stays session-only on Authorize; workspace capabilities stay session-only and are never stoned
- Scope is navigation/retrieval context only — never a synthetic global HEAD

## Reachability checklist

- [x] Chat Answer Depth (`cairnstone_grounded_response*`)
- [x] Work / Code Session (`cairnstone_code_session_console_view` path)
- [x] Universe / Bird's Eye overlay
- [x] Scope selection (sheet)
- [x] Inbox / Handoff / Activity
- [x] Stones / Evidence
- [x] Invite / mailbox / compose
- [x] Authorize
- [x] Runtime MCP + actor settings

## Tests

```bash
node --test answer-depth.test.js shell-nav.test.js
```
