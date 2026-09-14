# V7.7.9a — Pre-shell baseline checklist

Captured against live Console tip `f369f0c` (V7.7.8c Answer Depth) before the responsive-shell migration. Presentation-only notes; no authority claims.

## Navigation reachability (baseline)

| Capability | Baseline entry | Notes |
|---|---|---|
| Chat / Answer Depth | Tab: Chat | First peer among 9 tabs |
| Evidence | Tab: Evidence | Peer tab |
| Inbox | Tab: Inbox | Peer tab |
| Handoff | Tab: Handoff | Peer tab |
| Activity | Tab: Activity | Peer tab |
| Stones | Tab: Stones | Peer tab |
| Code Session | Tab: Code | Peer tab |
| Invite | Tab: Invite | Peer tab |
| Authorize | Tab: Authorize | Peer tab |
| Scope | Permanent card above tabs | Always visible |
| Bird's Eye / Universe | Button on Scope card | Overlay |
| Runtime MCP / Actor | Permanent runtime card | Always visible |

## First-action distance

- **Chat:** Scope + runtime cards + 9-tab sticky strip sit above Ask. Question textarea and primary CTA are reachable after ~1–1.5 viewports of setup chrome on phone widths.
- **Code Session:** Same chrome; Code is a peer tab (often requires horizontal scroll or 3×3 matrix scan). Load console view is the first in-panel action after selecting Code.

## Viewport / overflow (phone ~320–430px)

- Primary nav uses a **3×3 tab matrix** (sticky top); tabs wrap rather than a thumb-zone bottom bar.
- No dedicated bottom navigation.
- Scope + runtime cards consume first-screen space; raw MCP URL is permanently visible.

## Scope / context visibility

- Scope summary + authority line always on screen above content.
- Actor ID and MCP URL always on screen.
- Active Code Session id is **not** in the global header (only inside Code panel / sessionStorage).

## Loading-state behavior (preserve)

- Chat controls stay visible+disabled while Scope resolves (V7.7.8c stability pattern).
- Scope card shows “Loading Scope…” / “Resolving…” copy rather than removing the card.
- Health pill reflects runtime check status.

## 9a target (post-change)

- Primary IA: **Chat · Work · Universe · Inbox · More**
- Mobile bottom nav + desktop rail
- Compact context bar; Scope/runtime in sheets
- All baseline capabilities remain reachable (see `docs/V7_7_9A_RESPONSIVE_SHELL.md`)
