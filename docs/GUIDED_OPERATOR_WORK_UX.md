# Guided operator Work UX (Advanced · ID-ish steps)

The **default** Work surface is now the **Zero-ID questionnaire** — see [`ZERO_ID_QUESTIONNAIRE_WORK_UX.md`](./ZERO_ID_QUESTIONNAIRE_WORK_UX.md).

This document describes the prior six-step order-of-operations guide, which remains available under **Advanced · ID-ish steps & raw values**.

Presentation-only Console slice. Does **not** change `scoped_grant` semantics, mint broader authority, auto-dispatch, or move accepted-state HEADs. **10h.4 runtime acceptance remains a separate gate.**

## Operator flow (Advanced escape hatch)

1. Choose workspace (ID + session-only capability)
2. Add collaborator (workspace invite — distinct from Share reference)
3. Select or create Code Session (honest discovery)
4. Describe work
5. Review + Human Commit proposal
6. Dispatch + Watch (Events / Agent Tree; Retention is diagnostic)

Raw IDs and base-commit SHAs live under Advanced. Default Work does not ask for them.

## Chat vs Code Session

- Context pill **Chat** = Conversation / Chat Session (thread) — preferred label; not “Session · model”
- Context pill **Code** = Code Session (shown only when bound)
- Legacy **Session** pill is removed (no third session-ish control on mobile)

## Honest Code Session discovery

Uses `cairnstone_conversation_session_list` and only offers rows with a real `code_session_id`. Create uses `cairnstone_code_session_create` with required worker fields. No fake raw-ID-only select. Worker list API was **not** required for this slice.

## Files

- `work-guide.js` / `work-guide.test.js` — questionnaire + Advanced state machines
- `work-guide-panel.js` — DOM wiring
- `index.html`, `styles.css`, `app.js`, `code-session.js` — shell integration

## Smoke

```bash
node --test work-guide.test.js work-surface.test.js progressive-disclosure.test.js shell-nav.test.js
```
