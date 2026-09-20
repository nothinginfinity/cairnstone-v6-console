# Operator-path blockers (msg:dd031b66)

Acceptance: project-memory/console-operator-manual-current-live.md
Do not call full manual smoke ready until all four land + deploy evidence.
START HERE unchanged.

## 1. One-next-action workspace access — PR #28
Default Work for Give <actor> read access + workspace target:
- one summary + one CTA Approve & send invite (Human Commit)
- workspace invite ls+read only, never access_grant_create
- Waiting for claim → Claimed/Ready
- hide Route / Dispatch / Code Session / Events / Retention / raw JSON

Local implementation on this worktree: work-guide.js oneNextActionModel, work-guide-panel.js mint CTA, invite.js mintWorkspaceInviteAndNotify, app.js route context. Tests 159 pass locally including 3 new oneNextAction cases.

## 2. Get my workspace access (console:jared)
Fresh operator self-bootstrap onto ws:v775-multi-actor-workplane without pasting ws:/bearer in default mode. Minimum scopes. No silent widen.
Not landed on this branch yet.

## 3. Secure invite claim handoff
Claim without hunting a mailbox-bearer paste target. Bearers session-only. Lifecycle: Invite sent → Waiting → Claimed.
Not landed yet.

## 4. Auto-bind Code Session → Conversation Session
cairnstone_conversation_session_create/update with workspace_id + code_session_id, CAS on update. No HEAD movement.
Not landed yet.
