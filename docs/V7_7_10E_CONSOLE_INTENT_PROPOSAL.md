# V7.7.10e CONSOLE — Intent Router / proposal cards / Dispatch Human Commit UX

**Status:** Console presentation slice over live worker **0.5.43** (10c intent route + 10d dispatch already shipped).  
**Repo:** `nothinginfinity/cairnstone-v6-console`  
**Worker gate:** START HERE `5d88d859…` (V7.7.10d.2 COMPLETE)

## What this ships

| Surface | Calls | Never |
|---------|-------|-------|
| **Route intent** | `cairnstone_intent_route` | Creates grants / task runs / forwards |
| **Proposal card** | Renders 10c `proposal` + missing fields | Auto-commits |
| **Commit proposal** | The proposed 10b tool after Human Commit | Dispatches a Task Run |
| **Dispatch card** | Proposed Task Run + optional executor route | Treats PR/job as accepted state |
| **Dispatch Human Commit** | `cairnstone_task_run_dispatch` with `human_commit:true` | Runs from chat text or propose |

## Authority invariants

1. Presentation never calls `set_head` / `set_path_head`.
2. Intent match never mutates.
3. Two Human Commits for assign→dispatch.
4. MCP args omit UI-only fields.
5. Task Run completion ≠ accepted state.

## Files

`intent-proposal.js`, `intent-proposal.test.js`, `index.html`, `app.js`, `styles.css`, this doc.

```bash
node --test intent-proposal.test.js access-share.test.js
```
