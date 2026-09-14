# V7.7.9e — Progressive disclosure + Saved Views

**Status:** Console implementation slice (this repo).  
**Baseline Console tip:** `a7ddd868e3f9fa7183321fbe64a8548da7eb93b2` (V7.7.9d Universe v2, live-verified).  
**Worker contract (live):** **0.5.38**.  
**Activation gate (project-memory):** `9fc1047c6b6b02ffa6445c4d2d79dac3def3ce4eb16c500c002e17d458436a27` (`project-memory/v779d-complete-live-verified.md`).  
**Architecture slice:** V7.7.9 Console UX Architecture — progressive disclosure + Saved Views.

## What this slice owns

Presentation-only Console UX:

1. **Progressive disclosure** across Scope sheet, Stones, Evidence (aligned with 9b drawer patterns), Work (builds on 9c), and Authorize — advanced/raw controls collapse behind clear steps; first paint stays task-oriented; empty/loading/error/disabled remain explicit.
2. **Saved Views** — named browser-local navigation presets capturing presentation/selectors only (primary surface, Scope selectors, Universe LOD/view mode, optional filters + disclosure prefs).
3. **On open** — re-resolve Scope via existing `cairnstone_resolve_scope`; show freshness honestly if a prior presentation hint no longer matches; never treat a Saved View as accepted-state.
4. **Preserve** — 9a IA + context bar; 9b Chat config/Evidence drawer; 9c Work + Inbox hub; 9d Universe v2; Authorize distinct under More.

## Explicit non-goals (deferred)

- **9f** Full cross-device UX acceptance (iPhone + desktop + a11y/reduced-motion + performance + reachability + live authority/mutation boundary sweep)
- Chain / path HEAD mutation from Console UX
- New worker authority APIs
- Cross-device sync of Saved Views
- Storing Saved Views as stones

## Mapping table

| Goal | Console change | Authority note |
|---|---|---|
| Progressive Scope | Compact identity first; browse + diagnostics in `<details>` | Still `cairnstone_resolve_scope` |
| Progressive Stones | Browse/search first; summary then raw LOD/refs | Worker-reported HEADs only; no HEAD writes |
| Progressive Evidence | Summary first; accepted/skills/memory/observability stepped | Same response_id / Scope snapshot; `response_lod` ≠ `stone_lod` |
| Progressive Work | 9c details + `data-section` prefs for Saved Views | Runtime from `console_view` only |
| Progressive Authorize | Token + list + material effect first; args/raw drill-down | REST operator surface; bearer session-only |
| Saved Views capture | `saved-views.js` serialize selectors + presentation | localStorage only; no secrets |
| Saved Views open | `openSavedView` → apply presentation → `setScope` / resolve | Fresh authority; never frozen HEADs |
| Freshness honesty | Optional presentation hint vs fresh digest | Hint is not accepted truth |
| 9a–9d preserved | Nav, Chat, Work, Inbox, Universe, Authorize under More | Client only |

## Baseline checklist (9e)

- [x] Progressive disclosure on Scope / Stones / Evidence / Work / Authorize
- [x] First paint task-oriented; advanced/raw collapsed by default where appropriate
- [x] Empty / loading / error / disabled states explicit
- [x] Saved Views store selectors + presentation only (localStorage)
- [x] No secrets / operator tokens / workspace capabilities in Saved View payloads
- [x] No frozen chain/path HEADs as accepted truth in Saved Views
- [x] Open re-resolves Scope via `cairnstone_resolve_scope`
- [x] Freshness honesty when prior hint diverges
- [x] 9a IA + context bar; 9b Chat/Evidence; 9c Work/Inbox; 9d Universe; Authorize distinct
- [x] `accepted_state_authority` remains false from Console UX
- [x] `response_lod` ≠ `stone_lod` remains distinct in copy + models
- [x] `node --test` prior suites + new Saved Views / progressive disclosure tests green

## Files

- `saved-views.js` / `saved-views.test.js` — serialize / parse / store / open (+ mocked resolve)
- `progressive-disclosure.js` / `progressive-disclosure.test.js` — Scope/Stones/Evidence/Authorize models
- `app.js` / `index.html` / `styles.css` — sheet + surface wiring
- `shell-nav.test.js` — reachability assertions
- `README.md` — brief slice note
- This doc

## Tests

```bash
node --test answer-depth.test.js shell-nav.test.js chat-evidence.test.js work-surface.test.js comms-hub.test.js universe-v2.test.js saved-views.test.js progressive-disclosure.test.js
```

## Intentional follow-ons

- **9f** Full cross-device UX acceptance
- Optional export/import of Saved Views (still client-only; still selectors only)
- Deeper Evidence drawer ↔ More Evidence section sync of disclosure prefs
- Live smoke: save view on Universe list + Scope repo mode → open after HEAD move → freshness banner
- Optional “pin” Saved View on context bar without opening the sheet
