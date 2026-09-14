# V7.7.9d — Universe v2

**Status:** Console implementation slice (this repo).  
**Baseline Console tip:** `6cba3b62c4cec2c026138af23919e584bffd4ea2` (V7.7.9c Work + communications, live-verified).  
**Worker contract (live):** **0.5.38**.  
**Activation gate (project-memory):** `f8c56a100397605e904a447650d62f56a24b10e496253b1c1cace4ac4982b0c6` (`project-memory/v779c-complete-live-verified.md`).  
**Architecture slice:** V7.7.9 Console UX Architecture — Universe semantic zoom Vault → Repo → Chain → Intelligence.

## What this slice owns

Presentation-only Universe v2 on the 9a/9b/9c shell:

1. **Semantic zoom** — Vault → Repo → Chain → Intelligence. Zoom changes presentation depth only; it does not invent edges, HEADs, or accepted state.
2. **Spatial / touch** — Lightweight DOM/CSS spatial projection with pan + pinch-scale-friendly wheel zoom; touch-action pan on the canvas wrap.
3. **List / grid parity** — Spatial, list, and grid render the same current-LOD entity set; mode switches preserve selection/focus when identity remains in view.
4. **Search-to-focus** — Filter dims non-matches and focuses hits without mutating accepted state.
5. **Bounded LOD loading** — Vault/Repo/Chain use `cairnstone_vault_catalog` provenance already loaded for Scope; Intelligence loads one focused chain via `cairnstone_resume_chain` (`detail=start_here`) with `cairnstone_manifest_v2` (`detail=orientation`) fallback. No vault-wide dump at deep LOD.
6. **Preserve** — 9a IA (Chat · Work · Universe · Inbox · More), context bar / Scope sheet; 9b Chat; 9c Work + Inbox hub; Authorize distinct under More.

## Explicit non-goals (deferred)

- **9e** Saved Views / broader progressive disclosure
- **9f** Full cross-device acceptance
- Chain / path HEAD mutation; Console accepted-state authority
- New worker authority APIs
- Mandatory WebGL / heavy spatial framework rewrite

## Mapping table

| Goal | Console change | Authority note |
|---|---|---|
| Semantic zoom Vault→Repo→Chain→Intelligence | `universe-v2.js` zoom levels + overlay LOD controls | Presentation depth only |
| Spatial / touch projection | `#universeCanvas` + pan/zoom transform; Prax-inspired radial/ring layout | Never creates graph edges |
| List / grid parity | `#universeFallbackList` + `#universeGrid` share `buildUniverseEntities` | Same Scope selectors as spatial |
| Search-to-focus | `searchToFocus` dims/focuses; selection via `preserveSelection` | No accepted-state writes |
| Bounded LOD | `lodLoadPlan` → catalog / `resume_chain` / `manifest_v2` | Existing MCP read APIs only |
| Scope parity | `scopeSelectorFromEntity` → `setScope` / `resolve_scope` | Worker-authoritative snapshot |
| Empty/loading/error | `universeSurfaceState` + `#universeStatus` / intel panel | Explicit honesty |
| 9a–9c preserved | Nav, Chat, Work, Inbox, Authorize under More | Client only |

## Baseline checklist (9d)

- [x] Semantic zoom levels Vault → Repo → Chain → Intelligence (or labeled equivalent)
- [x] Spatial view + list + grid show the same entities at a LOD
- [x] Mode / zoom switches preserve selection when identity still visible
- [x] Search focuses matches without mutating accepted state
- [x] Intelligence LOD loads one bounded orientation card (not vault-wide)
- [x] No synthetic graph edges / global HEAD in projection copy or code
- [x] Scope resolution remains `cairnstone_resolve_scope`
- [x] Empty / loading / error states explicit
- [x] 9a IA + context bar; 9b Chat; 9c Work/Inbox; Authorize under More unchanged contracts
- [x] `accepted_state_authority` remains false from Console UX
- [x] `node --test … universe-v2.test.js` (and prior suites) green

## Files

- `universe-v2.js` / `universe-v2.test.js` — zoom / selection / search / LOD helpers
- `app.js` / `index.html` / `styles.css` — Universe overlay wiring
- `shell-nav.test.js` — reachability assertions
- `README.md` — brief slice note
- This doc

## Tests

```bash
node --test answer-depth.test.js shell-nav.test.js chat-evidence.test.js work-surface.test.js comms-hub.test.js universe-v2.test.js
```

## Intentional follow-ons

- **9e** Saved Views / progressive disclosure across Stones and Authorize
- Richer Intelligence neighborhood (bounded HEAD edges from orientation) without inventing edges Console-side
- Optional deep-link from Chat evidence → Universe focus on cited chain
- Live smoke of Intelligence LOD against mature chains with path-head digests populated
- Further Prax spatial polish if a shared pattern lands in repo history
