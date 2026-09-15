# Actor & Inbox Discovery — Console UI/UX refinement

**Status:** implementation (presentation / discovery only)  
**Approved UX stone:** `ac56e5c946effc3bdf17a937bbe2a800b7c29d1ec6b3c546898539a59b7e5f59` (`project-memory/console-uiux-actor-inbox-discovery.md`)  
**START HERE gate (do not reopen 9a–9f):** `6679f28bb28b91ddcad27d7907a6788302b4e04f6067c9fc900e0a7ec3fd6042` (V7.7.9f COMPLETE / LIVE-VERIFIED)  
**Baseline console tip:** `54ef50a1e6ac6d7ec7a05ca1a4466ba304d20232`

## What shipped

Shared **Actor Inbox Navigator** across Inbox · Handoff · Activity:

| Surface | Behavior |
|---------|----------|
| **Inbox** | Single-select friendly actor picker → combined mailbox; `All · Chat · Work` when both planes exist |
| **Activity** | Multi-select actors (“Whose activity?”) — no primary comma-separated raw IDs |
| **Handoff** | Same picker for recipient discovery (defaults to work mailbox `:cairnstone-v6`) |
| **Advanced** | Progressive disclosure for exact / federated Custom Actor IDs |

Discovery model (client-only):

- Seed known canonical actors: Grok, Claude, ChatGPT, Grok Bot
- Canonical pairing: Chat = `<ns>:chat`, Work = `<ns>:cairnstone-v6`
- Newly observed sender/recipient IDs from AC1 listings surface automatically
- Exact IDs remain secondary metadata under the picker / Advanced

## Authority / invariants held

- Presentation / discovery only — no new execution, mutation, or accepted-state authority
- AC1 messages remain immutable transport Stones
- Chat/work mailbox separation remains canonical
- Work suffix stays **`:cairnstone-v6`** (no silent migrate to `:cairnstone-v7`)
- Worker APIs unchanged: still `cairnstone_get_inbox` / `cairnstone_read_message` / `cairnstone_dispatch_handoff`
- No competing authoritative actor registry

## Files

| File | Role |
|------|------|
| `actor-inbox-nav.js` | Directory / plane / stats helpers |
| `actor-inbox-nav.test.js` | Unit tests |
| `index.html` | Picker + plane tabs + Advanced markup |
| `app.js` | Wiring into Inbox / Handoff / Activity |
| `styles.css` | Responsive picker / plane / chip styles |

## Manual / dev-check notes (mobile + desktop)

Viewport targets: **mobile ~390×844** and **desktop ≥1280** (same shell as V7.7.9a/f).

### Inbox

1. Open **Inbox** primary → subnav Inbox.
2. Confirm friendly chips (Grok, Claude, ChatGPT, Grok Bot) — not a primary raw ID field.
3. Select **Claude** → plane tabs **All · Chat · Work** appear; meta shows exact mailbox IDs.
4. Refresh → messages load via existing `get_inbox` for selected plane(s); unread badges update when data returns.
5. Open **Advanced / Custom Actor ID** → enter `console:jared` → Console appears in directory; exact ID remains secondary.

### Activity

1. Open **Activity**.
2. Label reads **Whose activity?**; multi-select two+ actors without typing commas.
3. Refresh → aggregated list; plane chips on rows when recipient IDs encode chat/work.
4. Advanced fallback still accepts comma-separated exact IDs.

### Handoff

1. Open **Handoff**.
2. Recipient picker reuses the same actor chips; selecting Claude fills `claude:cairnstone-v6`.
3. Advanced can add unusual recipients by exact ID.
4. Dispatch still requires exact participating Scope chain (unchanged).

### Shell / regression

1. Bottom nav (mobile) + rail (desktop) unchanged: Chat · Work · Universe · Inbox · More.
2. No HEAD mutation from navigation / picker / plane tabs.
3. Do **not** reopen V7.7.9a–f acceptance unless a real regression is documented.

### Automated checks

```bash
node --test actor-inbox-nav.test.js comms-hub.test.js shell-nav.test.js ux-acceptance.test.js
```
