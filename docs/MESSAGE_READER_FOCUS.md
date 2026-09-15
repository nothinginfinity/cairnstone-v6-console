# Message Reader focus / navigation

**Status:** Approved post-V7.7.9 Console presentation refinement.  
**UX stone (canonical):** `bc4b28fe5123148fa28cde737b5796d65e458ed624fb1467138a872e82fb4fcf` (`project-memory/console-uiux-message-reader-focus.md`).  
**Console baseline:** `8dfecffe0f1226957058af5c0d6d8806030cdfe2` (Actor Inbox Navigator — PR #12).

## Problem

Selecting an Inbox/Activity message updated Message Reader state, but on mobile the reader card sat far down the page flow, forcing long manual scroll. A follow-up desktop gap (PR #13 tip) also left the inline reader off-screen until manual scroll when quiet list refresh raced a smooth `scrollIntoView`.

## Behavior

| Viewport | Behavior |
|---|---|
| Mobile (~390×844, width &lt; 860) | Focused `messageReaderSheet` over the current list with **Back**; list actor/plane/filter/thread state and scroll position restore on close |
| Desktop (≥1280, width ≥ 860) | Inline `#messageReaderCard` on Inbox; Activity selection still routes to Inbox reader; **instant** `scrollReaderIntoView` (sticky context-bar offset + `scroll-margin-top`) runs on select and again after quiet list refresh so the reader is never stranded |

- Immediate loading copy while `cairnstone_read_message` runs; honest error title/body on failure.
- Focus moves to the reader title (`tabindex="-1"`) after open/load.
- Deep body content scrolls inside the sheet; opening never leaves the reader off-screen.
- Browser Back / Escape close the focused sheet when it pushed history.

## Invariants

- Presentation only; AC1 message stones immutable; read may update delivery state only.
- No chain/path HEAD mutation; no new execution/accepted-state authority.
- Work mailbox suffix remains `:cairnstone-v6`.
- Actor Inbox Navigator (chips, Chat/Work planes, Activity multi-select, Advanced custom ID) unchanged.
- Prefer existing `cairnstone_read_message` — no new worker APIs.

## Dev checks

```bash
node --test message-reader-focus.test.js shell-nav.test.js ux-acceptance.test.js actor-inbox-nav.test.js comms-hub.test.js
python3 -m http.server 8080
```

Manual: mobile ~390×844 tap message → sheet visible without page scroll; Back restores list. Desktop ≥1280 open message → inline reader immediately in view (no manual scroll).
