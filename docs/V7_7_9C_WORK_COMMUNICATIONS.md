# V7.7.9c — Work + communications consolidation

**Status:** Console implementation slice (this repo).  
**Baseline Console tip:** `6b04de9` (V7.7.9b Chat + contextual evidence, live-verified).  
**Worker contract (live):** **0.5.38** / V7.7.7f `cairnstone_code_session_console_view` + AC1 inbox/handoff.  
**Canonical architecture (worker):** `docs/V7_7_9_CONSOLE_UX_ARCHITECTURE.md` — 9c slice.  
**Activation gate (project-memory):** `5fa90e1d27860ad5a5af0a9806ec0cea2c832de9a945525e193bdfba135379f9` (`v779b-complete-live-verified`).

## What this slice owns

Presentation-only Work + communications polish on the 9a/9b shell:

1. **Work surface** — Evolve V7.7.7f Code Session into a task-first Work home: current task hero, lifecycle/project chips, progressive disclosure for actors, tests, working tree, checkpoints, environment/sandbox, leases, receipts, and action catalog. Operator actions still map only to existing APIs (invite = V7.7.6 mint; propose/merge = `cairnstone_workspace_propose_accept`).
2. **Communications hub** — Deepen Inbox · Handoff · Activity under the Inbox primary: shared thread/list row patterns, clear intent labels, explicit empty/loading/error states, AC1 identity honesty (`message_id` / `stone_hash`), evidence-based handoff chain association.
3. **Preserve** — 9a IA (Chat · Work · Universe · Inbox · More), context bar, 9b Chat (Answer Depth, Chat config, Evidence drawer), Authorize distinct under More.

## Explicit non-goals (deferred)

- **9d** Universe v2
- **9e** Saved Views / progressive disclosure across other surfaces
- **9f** Cross-device acceptance
- Chain / path HEAD mutation; Console accepted-state authority
- Silent merge of Chat / Work / Authorize authority

## Mapping table

| Goal | Console change | Authority note |
|---|---|---|
| Task-oriented Work first paint | `#panel-code` task hero + empty/loading/error; details in `<details>` | Runtime identity from `cairnstone_code_session_console_view` only |
| Progressive Work disclosure | Actors / tests / tree / checkpoints / env / receipts / action catalog | No duplicated UI truth; list APIs remain authoritative for checkpoints/tree |
| Action catalog honesty | `work-surface.js` maps buttons → existing APIs; `grants_authority: false` | Invite = V7.7.6; propose = propose-accept only |
| Comms intent labels | Subnav titles + hub blurbs + intent badges on rows | Correspondence grants no execution authority |
| Shared list/thread patterns | `comms-hub.js` normalize / group / filter; Inbox optional group-by-thread | Presentation grouping only |
| Evidence-based handoff Scope | `handoffChainAllowed` against participating chains | No inventing chain from actor/subject text |
| 9a/9b preserved | Nav, Chat config/evidence, Authorize under More | Client only |

## Baseline checklist (9c)

- [x] Work first paint centers current task (not a flat dump of all panels)
- [x] Work progressive disclosure for actors / tests / tree / env / actions
- [x] Operator actions unchanged in API mapping; disabled until load
- [x] Explicit empty / loading / error on Work and Inbox/Activity lists
- [x] Inbox · Handoff · Activity remain distinct intents under Inbox primary
- [x] Shared message row + optional thread grouping; immutable IDs shown
- [x] Handoff still requires exact participating Scope chain
- [x] Authorize remains under More (visually/operationally distinct)
- [x] Chat Answer Depth / config sheet / evidence drawer unchanged contracts
- [x] `accepted_state_authority` remains false from Console UX (no writes of true)
- [x] `node --test answer-depth.test.js shell-nav.test.js chat-evidence.test.js work-surface.test.js comms-hub.test.js` passes

## Files

- `work-surface.js` / `work-surface.test.js` — Work first-paint + action catalog helpers
- `comms-hub.js` / `comms-hub.test.js` — communications hub helpers
- `code-session.js` / `app.js` / `index.html` / `styles.css` — surface wiring
- `shell-nav.test.js` — reachability + first-paint assertions
- This doc

## Tests

```bash
node --test answer-depth.test.js shell-nav.test.js chat-evidence.test.js work-surface.test.js comms-hub.test.js
```

## Intentional follow-ons

- Live smoke of Work against a real Code Session with environment/sandbox/leases populated.
- Optional Work ↔ Chat cross-link (“open this in Work”) without duplicating session authority.
- 9d Universe v2; 9e Saved Views; deeper progressive disclosure on Stones/Authorize.
- Richer Activity filters (task request/result, invites) once listing metadata is trustworthy.
