/**
 * TARGET KIND selects the workflow. Default Work shows exactly ONE next action.
 * Workspace access is invite/capability lifecycle — never access_grant_create.
 */

export function oneNextActionModel({
  answers = {},
  resolveComplete = false,
  resolveBlocked = false,
  inviteState = null,
  confirmTitle = ''
} = {}) {
  const actionId = String(answers.actionId || '').trim();
  const targetKind = String(answers.accessTargetKind || '').trim();
  const principal = String(answers.whoDisplay || answers.whoMailboxId || 'this principal').trim();
  const targetLabel = String(answers.accessTargetLabel || 'this workspace').trim();
  const invite = inviteState && typeof inviteState === 'object' ? inviteState : null;
  const title = String(confirmTitle || '').trim()
    || ('Give ' + principal + ' read access to ' + targetLabel + '?');

  if (actionId === 'give_access' && (targetKind === 'workspace' || targetKind === 'conversation' || !targetKind)) {
    if (invite && invite.status === 'claimed') {
      return {
        workflow: 'workspace_invite',
        showGenericIntent: false,
        showEvents: false,
        showRetention: false,
        showCodeSession: false,
        showResolveRows: false,
        primaryCta: { label: principal + ' has read access', action: 'noop_invite_done' },
        card: {
          title: principal + ' has read access',
          body: principal + ' claimed the workspace invite.',
          buttonLabel: null
        }
      };
    }
    if (invite && (invite.status === 'waiting' || invite.status === 'sent')) {
      return {
        workflow: 'workspace_invite',
        showGenericIntent: false,
        showEvents: false,
        showRetention: false,
        showCodeSession: false,
        showResolveRows: false,
        primaryCta: { label: 'Waiting for ' + principal + ' to claim', action: 'refresh_invite' },
        card: {
          title: 'Waiting for ' + principal + ' to claim',
          body: 'Invite sent for read access to ' + targetLabel + '. Refresh after they claim.',
          buttonLabel: 'Refresh invite status'
        }
      };
    }
    if (resolveBlocked && !answers.accessTargetId) {
      return {
        workflow: 'workspace_invite',
        showGenericIntent: false,
        showEvents: false,
        showRetention: false,
        showCodeSession: false,
        showResolveRows: true,
        primaryCta: { label: 'Access to what?', action: 'focus_access_target' },
        card: null
      };
    }
    return {
      workflow: 'workspace_invite',
      showGenericIntent: false,
      showEvents: false,
      showRetention: false,
      showCodeSession: false,
      showResolveRows: Boolean(resolveComplete || resolveBlocked || answers.accessTargetId),
      primaryCta: { label: 'Approve & send invite', action: 'approve_workspace_invite' },
      card: {
        title: title,
        body: 'This sends a workspace invite with list + read only. The button is Human Commit. No Route intent, no access_grant_create, no Dispatch.',
        buttonLabel: 'Approve & send invite',
        scopes: ['ls', 'read'],
        membership_role: 'drafter'
      }
    };
  }

  if (actionId === 'give_access' && targetKind === 'code_session') {
    return {
      workflow: 'object_grant',
      showGenericIntent: true,
      showEvents: false,
      showRetention: false,
      showCodeSession: true,
      showResolveRows: true,
      primaryCta: { label: 'Review \u00b7 Human Commit', action: 'focus_review' },
      card: null
    };
  }

  return {
    workflow: actionId === 'forward' ? 'forward' : 'assign',
    showGenericIntent: true,
    showEvents: true,
    showRetention: true,
    showCodeSession: actionId !== 'forward',
    showResolveRows: true,
    primaryCta: null,
    card: null
  };
}
