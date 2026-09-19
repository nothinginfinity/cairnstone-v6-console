# Console Zero-ID questionnaire Work UX

Presentation-only Console slice. **Humans answer human questions; CairnStone resolves CairnStone values.**

Does **not** change `scoped_grant` semantics, mint broader authority, auto-dispatch, auto Human-Commit, or move accepted-state HEADs. **10h.4 runtime acceptance remains a separate gate.**

## Default Work (3 questions, one at a time)

1. **What?** — plain-language outcome (no session IDs / SHAs)
2. **Who?** — actor picker by **human name** (Grok, Claude, ChatGPT, Grok Bot, …)
3. **What should they do?** — Assign / Give access / Forward / custom plain language

Then CairnStone **auto-resolves** (presentation discovery only):

- Workspace (Conversation bindings / session prefs)
- Access readiness (session capability present? grants still second-tap)
- Code Session (honest Conversation Session bindings)
- `source_repos` / base pins (**SHA hidden** in default mode)
- Operational IDs (kept out of default copy)
- Task Run + events surface readiness after Route intent

## Explicit second taps (never automatic)

- Access grant
- Human Commit (proposal)
- Dispatch

## Advanced

The prior **6 ID-ish steps** (choose workspace → collaborator → Code Session → describe → review → dispatch IDs) live under **Advanced · ID-ish steps & raw values**, including raw SHAs for Create Code Session.

## Honest discovery

Uses `cairnstone_conversation_session_list` (+ optional `cairnstone_code_session_get` for pins). Worker list API was **not** required. Worker untouched for this slice.

## Files

- `work-guide.js` / `work-guide.test.js` — questionnaire + auto-resolve model
- `work-guide-panel.js` — DOM wiring
- `index.html`, `styles.css`, `app.js` — shell integration
- `docs/GUIDED_OPERATOR_WORK_UX.md` — prior 6-step guide (still valid as Advanced)

## Smoke

```bash
node --test work-guide.test.js work-surface.test.js progressive-disclosure.test.js shell-nav.test.js
```
