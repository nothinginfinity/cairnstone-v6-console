# V7.7.10b CONSOLE — Give Access / Assign / Forward-with-note

**Status:** Console presentation slice (worker grant APIs expected on **0.5.40**)  
**START HERE / gates:** `2cc7e85db994…` (10a live), amendment `eab0bdb8304f…`  
**Console baseline tip:** `e80e130f5784ceb3d0b4a3e8968ff8074b86c84d`  
**Repo:** `nothinginfinity/cairnstone-v6-console`

## What this ships

Canonical-object sharing entry points in the Console:

| Operation | Creates | Does not |
|-----------|---------|----------|
| **Give access…** | Call to `cairnstone_access_grant_create` after Human Commit | Does not copy message/Stone/repo bytes; `read`/`discuss` never imply execute |
| **Assign / Ask to work** | Task Run **proposal** via `cairnstone_task_run_propose` (same `attachment_refs`) | Does not grant access; does not auto-dispatch |
| **Forward with note** | New AC1 via existing `cairnstone_send_message` referencing original `object_ref` | Not the default share path |

Grant lifecycle surface (**More → Access**): list / revoke with honest `granted → first_read → revoked` labels. Revoke = **future access only**.

## UI entry points

| Surface | Where |
|---------|--------|
| Inbox / Message Reader | After reading a message — action bar (inline desktop + mobile sheet) |
| Stones | Detail card actions next to Copy hash |
| Evidence | More → Evidence + Chat Evidence drawer |
| Work / Code Session | Give access… / Assign when console view is loaded |
| Access | More → Access — grant list + revoke |

Share sheet reuses **Actor Inbox Navigator** chips for the principal picker (work mailbox default `:cairnstone-v6`). Advanced accepts exact mailbox IDs.

## Authority invariants

1. Presentation **never** calls `cairnstone_set_head` / `cairnstone_set_path_head`.
2. Human Commit checkbox required before grant / assign-proposal / forward; revoke uses an explicit confirm Commit.
3. Grants never invent Scope / workspace / Code Session capability widening.
4. If worker tools are absent (still 0.5.39), Commit degrades honestly with a structured result — no fake grant rows.
5. Attachment resolve uses `cairnstone_attachment_ref_resolve` when live; otherwise local typed-ref parse.

## Planned MCP names (worker 0.5.40)

- `cairnstone_access_grant_create` — args: `object_ref`, `principal_actor_id`, `permission`, `grantor_actor_id`/`actor_id`, `notify?`, `expires_at?`, `grant_id?`
- `cairnstone_access_grant_get`
- `cairnstone_access_grant_list` — args: `actor_id`, optional filters
- `cairnstone_access_grant_revoke` — args: `grant_id`, `actor_id`
- `cairnstone_access_grant_mark_first_read`
- `cairnstone_attachment_ref_resolve` — args: `object_ref` / `object_refs` / `refs`, optional `actor_id`
- `cairnstone_task_run_propose` — args: `attachment_refs`, `assignee_actor_id`, `requested_by`, `note?`
- `cairnstone_forward_with_note` — args: `to`, `note`, `object_ref`, `from`/`actor_id?`, `subject?` (fallback: `cairnstone_send_message`)

UI proposal objects may carry `accepted_state_authority: false` for display; **MCP args never include** that field (worker `additionalProperties: false`).

## Files

| File | Role |
|------|------|
| `access-share.js` | Object refs, proposals, honesty helpers |
| `access-share.test.js` | Unit tests |
| `index.html` | Share sheet + entry points + Access panel |
| `app.js` | Wiring, Human Commit, MCP degrade |
| `code-session.js` | Enable Work share actions |
| `styles.css` | Share / Access styles |
| `docs/V7_7_10B_CONSOLE_GIVE_ACCESS_ASSIGN.md` | This doc |

## Automated checks

```bash
node --test access-share.test.js shell-nav.test.js ux-acceptance.test.js actor-inbox-nav.test.js message-reader-focus.test.js
```

## Manual matrix (mobile ~390×844 + desktop ≥1280)

| # | Check | Mobile | Desktop |
|---|-------|--------|---------|
| M1 | Inbox → read message → Give access… opens share sheet with `msg:…` | | |
| M2 | Actor chips pick principal; Advanced exact ID works | | |
| M3 | Permission read/discuss/execute-against copy is honest | | |
| M4 | Commit disabled until Human Commit checked | | |
| M5 | On 0.5.39, Commit shows “Worker API not available yet” (no fake grant) | | |
| M6 | Assign shows proposal card; same object refs; no auto-dispatch claim | | |
| M7 | Forward with note creates AC1 referencing original (when send_message live) | | |
| M8 | Stones detail → Give access uses `stone:…` | | |
| M9 | Evidence drawer / panel → share uses `response:…` | | |
| M10 | Work → Give access / Assign enabled after Load; `session:…` | | |
| M11 | More → Access list honesty / revoke confirm (future access only) | | |
| M12 | Navigation / share sheet open never mcpCalls set_head / set_path_head | | |
| M13 | Keyboard: share sheet focusable; reduced-motion ok | | |

## Out of scope

Worker D1/MCP implementation · intent router 10c · executor dispatch 10d · DO/WS 10f.
