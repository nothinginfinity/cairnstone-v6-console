import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_OPERATOR_WORKSPACE,
  stripCapabilityPayload,
  mintSelfInvite,
  claimWorkspaceInvite,
  getMyWorkspaceAccess,
  bindCodeSessionToConversation
} from './operator-bootstrap.js';

describe('operator-bootstrap', () => {
  it('strips capability bearers from payloads', () => {
    const out = stripCapabilityPayload({
      invite_id: 'inv-1',
      workspace_capability: 'SECRET',
      mailbox_capability: 'SECRET2'
    });
    assert.equal(out.invite_id, 'inv-1');
    assert.equal(out.workspace_capability, undefined);
    assert.equal(out.mailbox_capability, undefined);
  });

  it('getMyWorkspaceAccess mints then claims without widening scopes', async () => {
    const calls = [];
    const operatorCall = async (path, opts) => {
      calls.push(['op', path, opts?.body || {}]);
      if (path === '/v1/workspace-invites') {
        return { invite: { invite_id: 'inv-9', workspace_id: DEFAULT_OPERATOR_WORKSPACE, principal_actor_id: 'console:jared' } };
      }
      if (path === '/v1/mailbox-capabilities') {
        return { mailbox_capability: 'mail.cap' };
      }
      throw new Error('unexpected ' + path);
    };
    const mcpCall = async (tool, args) => {
      calls.push(['mcp', tool, { ...args, mailbox_capability: args.mailbox_capability ? 'redacted' : undefined }]);
      if (tool === 'cairnstone_workspace_invite_claim') {
        return { workspace_capability: 'ws.cap', workspace_id: DEFAULT_OPERATOR_WORKSPACE };
      }
      throw new Error('unexpected tool ' + tool);
    };
    const r = await getMyWorkspaceAccess({ operatorCall, mcpCall, actorId: 'console:jared' });
    assert.equal(r.inviteId, 'inv-9');
    assert.equal(r.workspaceCapability, 'ws.cap');
    assert.equal(r.workspaceId, DEFAULT_OPERATOR_WORKSPACE);
    assert.equal(calls[0][1], '/v1/workspace-invites');
    assert.deepEqual(calls[0][2].scopes, ['ls', 'read']);
  });

  it('bindCodeSessionToConversation creates when no revision', async () => {
    const mcpCall = async (tool, args) => {
      if (tool === 'cairnstone_conversation_session_create') {
        return { conversation_id: args.conversation_id, code_session_id: args.code_session_id };
      }
      throw new Error(tool);
    };
    const r = await bindCodeSessionToConversation(mcpCall, {
      actorId: 'console:jared',
      workspaceId: DEFAULT_OPERATOR_WORKSPACE,
      codeSessionId: 'cs:abc'
    });
    assert.equal(r.mode, 'created');
    assert.equal(r.conversationId, 'cvs:abc');
  });

  it('bindCodeSessionToConversation CAS-updates when revision present', async () => {
    const mcpCall = async (tool, args) => {
      if (tool === 'cairnstone_conversation_session_get') return { session_revision: 3 };
      if (tool === 'cairnstone_conversation_session_update') {
        assert.equal(args.base_revision, 3);
        assert.equal(args.code_session_id, 'cs:abc');
        return { conversation_id: args.conversation_id, session_revision: 4 };
      }
      throw new Error(tool);
    };
    const r = await bindCodeSessionToConversation(mcpCall, {
      actorId: 'console:jared',
      workspaceId: DEFAULT_OPERATOR_WORKSPACE,
      codeSessionId: 'cs:abc',
      conversationId: 'cvs:ops'
    });
    assert.equal(r.mode, 'updated');
    assert.equal(r.conversationId, 'cvs:ops');
  });

  it('claimWorkspaceInvite refuses missing mailbox cap', async () => {
    await assert.rejects(
      () => claimWorkspaceInvite(async () => ({}), { inviteId: 'inv-1', actorId: 'console:jared' }),
      /mailbox_capability required/
    );
  });

  it('mintSelfInvite fails closed if mint returns a workspace bearer', async () => {
    await assert.rejects(
      () => mintSelfInvite(async () => ({ workspace_capability: 'nope', invite: { invite_id: 'x' } })),
      /mint_returned_bearer_forbidden/
    );
  });
});
