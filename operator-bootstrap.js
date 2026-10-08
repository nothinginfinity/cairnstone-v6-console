/**
 * Operator-path helpers. Session-only bearers. No HEAD movement.
 * Default workspace seed: ws:v775-multi-actor-workplane.
 */

export const DEFAULT_OPERATOR_WORKSPACE = 'ws:v775-multi-actor-workplane';
export const DEFAULT_OPERATOR_ACTOR = 'console:jared';

export function stripCapabilityPayload(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  delete out.workspace_capability;
  delete out.mailbox_capability;
  delete out.capability;
  delete out.token;
  return out;
}

export async function issueMailboxCapability(operatorCall, { actorId, ttlSeconds = 900, scopes = ['mail.read:self'] } = {}) {
  if (typeof operatorCall !== 'function') throw new Error('operatorCall required');
  const principal = String(actorId || DEFAULT_OPERATOR_ACTOR).trim();
  const issued = await operatorCall('/v1/mailbox-capabilities', {
    method: 'POST',
    body: { principal_actor_id: principal, scopes, ttl_seconds: ttlSeconds }
  });
  const cap = issued && issued.mailbox_capability;
  if (!cap) throw new Error('mailbox_capability_missing');
  return { mailboxCapability: cap, meta: stripCapabilityPayload(issued) };
}

export async function mintSelfInvite(operatorCall, {
  workspaceId = DEFAULT_OPERATOR_WORKSPACE,
  actorId = DEFAULT_OPERATOR_ACTOR,
  scopes = ['ls', 'read'],
  membershipRole = 'drafter',
  ttlSeconds = 86400
} = {}) {
  if (typeof operatorCall !== 'function') throw new Error('operatorCall required');
  const minted = await operatorCall('/v1/workspace-invites', {
    method: 'POST',
    body: {
      workspace_id: workspaceId,
      principal_actor_id: actorId,
      membership_role: membershipRole,
      scopes,
      ttl_seconds: ttlSeconds
    }
  });
  if (minted && minted.workspace_capability) throw new Error('mint_returned_bearer_forbidden');
  const invite = minted.invite || minted;
  return {
    inviteId: invite.invite_id,
    workspaceId: invite.workspace_id || workspaceId,
    principalActorId: invite.principal_actor_id || actorId,
    invite: stripCapabilityPayload(invite)
  };
}

export async function claimWorkspaceInvite(mcpCall, {
  inviteId,
  actorId = DEFAULT_OPERATOR_ACTOR,
  mailboxCapability,
  capabilityTtlSeconds = 900
} = {}) {
  if (typeof mcpCall !== 'function') throw new Error('mcpCall required');
  if (!inviteId) throw new Error('invite_id required');
  if (!mailboxCapability) throw new Error('mailbox_capability required');
  const claimed = await mcpCall('cairnstone_workspace_invite_claim', {
    invite_id: inviteId,
    actor_id: actorId,
    mailbox_capability: mailboxCapability,
    capability_ttl_seconds: capabilityTtlSeconds
  });
  const workspaceCapability = claimed && claimed.workspace_capability;
  if (!workspaceCapability) throw new Error('workspace_capability_missing');
  return {
    workspaceCapability,
    workspaceId: claimed.workspace_id || null,
    inviteId,
    meta: stripCapabilityPayload(claimed)
  };
}

export async function getMyWorkspaceAccess({
  operatorCall,
  mcpCall,
  actorId = DEFAULT_OPERATOR_ACTOR,
  workspaceId = DEFAULT_OPERATOR_WORKSPACE,
  mailboxCapability = '',
  scopes = ['ls', 'read']
} = {}) {
  const minted = await mintSelfInvite(operatorCall, { workspaceId, actorId, scopes });
  let mailbox = String(mailboxCapability || '').trim();
  if (!mailbox) {
    const issued = await issueMailboxCapability(operatorCall, { actorId });
    mailbox = issued.mailboxCapability;
  }
  const claimed = await claimWorkspaceInvite(mcpCall, {
    inviteId: minted.inviteId,
    actorId,
    mailboxCapability: mailbox
  });
  return {
    workspaceId: claimed.workspaceId || minted.workspaceId,
    inviteId: minted.inviteId,
    workspaceCapability: claimed.workspaceCapability,
    actorId
  };
}

export async function bindCodeSessionToConversation(mcpCall, {
  actorId,
  workspaceId,
  codeSessionId,
  conversationId = '',
  selectedRepo = ''
} = {}) {
  if (typeof mcpCall !== 'function') throw new Error('mcpCall required');
  if (!actorId) throw new Error('actor_id required');
  if (!codeSessionId) throw new Error('code_session_id required');

  if (conversationId) {
    const existing = await mcpCall('cairnstone_conversation_session_get', {
      conversation_id: conversationId,
      actor_id: actorId
    });
    const revision = Number(existing?.session_revision || existing?.revision || 0);
    if (revision >= 1) {
      const updated = await mcpCall('cairnstone_conversation_session_update', {
        conversation_id: conversationId,
        actor_id: actorId,
        base_revision: revision,
        workspace_id: workspaceId || undefined,
        code_session_id: codeSessionId,
        selected_repo: selectedRepo || undefined
      });
      return { mode: 'updated', conversationId, session: stripCapabilityPayload(updated) };
    }
  }

  const createdId = conversationId || ('cvs:' + codeSessionId.replace(/^cs:/, ''));
  const created = await mcpCall('cairnstone_conversation_session_create', {
    conversation_id: createdId,
    created_by: actorId,
    workspace_id: workspaceId || undefined,
    code_session_id: codeSessionId,
    selected_repo: selectedRepo || undefined,
    selected_actors: [actorId],
    status: 'active'
  });
  return {
    mode: 'created',
    conversationId: created?.conversation_id || createdId,
    session: stripCapabilityPayload(created)
  };
}
