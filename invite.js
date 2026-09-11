const DEFAULT_WORKSPACE = 'ws:v775-multi-actor-workplane';
const DEFAULT_ACTORS = [
  'chatgpt:cairnstone-v6',
  'claude:cairnstone-v6',
  'grok:cairnstone-v6',
  'grok-bot:cairnstone-v6'
];
const INVITE_STORE_KEY = 'cs.workspaceInvites';
const FALLBACK_PROMPT = 'Check your CairnStone work inbox.';

function loadTracked() {
  try {
    const raw = sessionStorage.getItem(INVITE_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTracked(rows) {
  const safe = rows.map(stripSecrets);
  sessionStorage.setItem(INVITE_STORE_KEY, JSON.stringify(safe));
}

function stripSecrets(row) {
  const copy = { ...row };
  delete copy.workspace_capability;
  delete copy.capability;
  delete copy.bearer;
  delete copy.token;
  if (copy.invite && typeof copy.invite === 'object') {
    const invite = { ...copy.invite };
    delete invite.workspace_capability;
    delete invite.capability;
    copy.invite = invite;
  }
  return copy;
}

function parseActors(text) {
  return String(text || '')
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function selectedScopes(root) {
  return [...root.querySelectorAll('[data-scope]')]
    .filter(el => el.checked)
    .map(el => el.getAttribute('data-scope'));
}

function lifecycleLabel(row) {
  const invite = row.invite || {};
  const state = invite.state || row.state || 'unknown';
  if (state === 'revoked') return 'Revoked';
  if (state === 'expired') return 'Expired';
  if (state === 'claimed') {
    const exp = Date.parse(invite.grant_expires_at || '') || 0;
    if (exp && exp <= Date.now()) return 'Expired';
    return invite.grant_expires_at ? 'Active' : 'Claimed';
  }
  if (row.inbox_status === 'read') return 'Read';
  if (row.inbox_status === 'delivered' || row.notice_sent) return 'Delivered';
  if (state === 'pending' || row.invite_id) return 'Created';
  return 'Unknown';
}

export function initInvitePanel(api) {
  const {
    mcpCall,
    operatorCall,
    toast,
    busy,
    esc,
    chip,
    actorId
  } = api;

  const els = {
    workspace: document.getElementById('inviteWorkspace'),
    actors: document.getElementById('inviteActors'),
    role: document.getElementById('inviteRole'),
    ttl: document.getElementById('inviteTtl'),
    prefix: document.getElementById('invitePrefix'),
    instruction: document.getElementById('inviteInstruction'),
    mint: document.getElementById('inviteMint'),
    refresh: document.getElementById('inviteRefresh'),
    list: document.getElementById('inviteList'),
    fallback: document.getElementById('inviteFallback'),
    copyFallback: document.getElementById('inviteCopyFallback'),
    composeTo: document.getElementById('composeTo'),
    composeSubject: document.getElementById('composeSubject'),
    composeBody: document.getElementById('composeBody'),
    composeIntent: document.getElementById('composeIntent'),
    composeSend: document.getElementById('composeSend'),
    composeResult: document.getElementById('composeResult')
  };

  if (els.actors && !els.actors.value.trim()) els.actors.value = DEFAULT_ACTORS.join('\n');
  if (els.workspace && !els.workspace.value.trim()) els.workspace.value = DEFAULT_WORKSPACE;
  if (els.fallback) els.fallback.value = FALLBACK_PROMPT;

  function render() {
    const rows = loadTracked();
    if (!els.list) return;
    if (!rows.length) {
      els.list.innerHTML = '<p class="muted">No invites in this browser session. Mint & Send creates one invite per actor. Only non-secret invite metadata is stored here.</p>';
      return;
    }
    els.list.innerHTML = rows.map(row => {
      const invite = row.invite || {};
      const fp = invite.invite_fingerprint || row.invite_fingerprint || '';
      const life = lifecycleLabel(row);
      return `<article class="message-item invite-card" data-invite-id="${esc(row.invite_id)}">
        <strong>${esc(invite.principal_actor_id || row.principal_actor_id || '—')}</strong>
        <div class="meta">${esc(life)} · ${esc(invite.state || 'unknown')} · ${esc(invite.workspace_id || row.workspace_id || '')}</div>
        <div class="chips">
          ${chip(`invite ${String(row.invite_id || '').slice(0, 8)}`)}
          ${chip(`fp ${String(fp).slice(0, 12)}`)}
          ${chip(`role ${invite.membership_role || row.membership_role || '—'}`)}
          ${chip(`inbox ${row.inbox_status || 'unknown'}`)}
        </div>
        <div class="invite-actions">
          <button type="button" class="secondary" data-copy-prompt="${esc(row.invite_id)}">Copy check-inbox prompt</button>
          <button type="button" class="secondary" data-revoke="${esc(row.invite_id)}">Revoke</button>
        </div>
      </article>`;
    }).join('');

    els.list.querySelectorAll('[data-copy-prompt]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-copy-prompt');
        const row = loadTracked().find(x => x.invite_id === id);
        const text = [
          FALLBACK_PROMPT,
          row?.invite?.workspace_id ? `Workspace: ${row.invite.workspace_id}` : '',
          row?.invite_id ? `Invite id: ${row.invite_id}` : '',
          row?.invite?.invite_fingerprint ? `Fingerprint: ${row.invite.invite_fingerprint}` : '',
          'Claim with cairnstone_workspace_invite_claim using your mailbox capability. Do not paste workspace bearers into Stones or chat.'
        ].filter(Boolean).join('\n');
        navigator.clipboard.writeText(text).then(() => toast('Copied fallback prompt')).catch(() => toast('Copy failed'));
      });
    });
    els.list.querySelectorAll('[data-revoke]').forEach(btn => {
      btn.addEventListener('click', () => revokeInvite(btn.getAttribute('data-revoke')));
    });
  }

  async function refreshRow(row) {
    const next = { ...row };
    try {
      const r = await operatorCall(`/v1/workspace-invites/${encodeURIComponent(row.invite_id)}`);
      next.invite = r.invite || r;
      next.state = next.invite?.state;
    } catch (err) {
      next.invite_refresh_error = err.message;
    }
    if (next.message_id && next.principal_actor_id) {
      try {
        const box = await mcpCall('cairnstone_get_inbox', {
          recipient_id: next.principal_actor_id,
          thread_id: next.thread_id || undefined,
          limit: 50
        });
        const hit = (box.messages || []).find(m => m.message_id === next.message_id);
        next.inbox_status = hit?.status || 'unknown';
        next.inbox_read_at = hit?.read_at || null;
      } catch {
        next.inbox_status = next.inbox_status || 'unknown';
      }
    }
    return stripSecrets(next);
  }

  async function refreshAll() {
    busy(els.refresh, true, 'Refreshing…');
    try {
      const rows = loadTracked();
      const updated = [];
      for (const row of rows) updated.push(await refreshRow(row));
      saveTracked(updated);
      render();
      toast(updated.length ? 'Invite lifecycle refreshed' : 'No tracked invites');
    } catch (err) {
      toast(err.message);
    } finally {
      busy(els.refresh, false, 'Refresh lifecycle');
    }
  }

  async function revokeInvite(inviteId) {
    try {
      await operatorCall(`/v1/workspace-invites/${encodeURIComponent(inviteId)}/revoke`, { method: 'POST', body: {} });
      const rows = loadTracked().map(row => row.invite_id === inviteId
        ? { ...row, invite: { ...(row.invite || {}), state: 'revoked' }, state: 'revoked' }
        : row);
      saveTracked(rows);
      render();
      toast('Invite revoked');
    } catch (err) {
      toast(err.message);
    }
  }

  function noticeBody(invite, instruction) {
    return [
      'CairnStone workspace invitation (non-secret notice).',
      `Workspace: ${invite.workspace_id}`,
      `Invite id: ${invite.invite_id}`,
      `Fingerprint: ${invite.invite_fingerprint}`,
      `Principal: ${invite.principal_actor_id}`,
      `Role: ${invite.membership_role}`,
      `Scopes: ${(invite.scopes || []).join(', ')}`,
      invite.path_prefix ? `Path prefix: ${invite.path_prefix}` : null,
      `Expires: ${invite.expires_at}`,
      instruction || invite.notice_instruction || 'Join the workspace and continue the current task.',
      FALLBACK_PROMPT,
      'Claim with cairnstone_workspace_invite_claim and your mailbox capability (mail.read:self).',
      'Do not paste workspace bearers into AC1, Stones, GitHub, or chat.'
    ].filter(Boolean).join('\n');
  }

  async function mintAndSend() {
    const workspaceId = els.workspace.value.trim();
    const actors = parseActors(els.actors.value);
    const scopes = selectedScopes(document);
    const role = els.role.value;
    const ttl = Number(els.ttl.value || 86400);
    const prefix = els.prefix.value.trim();
    const instruction = els.instruction.value.trim();
    if (!workspaceId || !actors.length) return toast('Workspace and at least one actor are required');
    if (!scopes.length) return toast('Select at least one scope');
    if (scopes.includes('propose') && role === 'drafter') return toast('propose requires a proposer/owner role');

    busy(els.mint, true, 'Minting…');
    const created = [];
    try {
      for (const actor of actors) {
        const minted = await operatorCall('/v1/workspace-invites', {
          method: 'POST',
          body: {
            workspace_id: workspaceId,
            principal_actor_id: actor,
            membership_role: role,
            scopes,
            path_prefix: prefix || undefined,
            ttl_seconds: ttl
          }
        });
        if (minted.workspace_capability) throw new Error('mint_returned_bearer_forbidden');
        const invite = minted.invite || minted;
        const messageId = `msg:v776b-invite-${invite.invite_id}`;
        const threadId = `workspace-invite-${workspaceId}`;
        let noticeSent = false;
        let inboxStatus = 'unknown';
        try {
          await mcpCall('cairnstone_send_message', {
            from: actorId(),
            to: [actor],
            content: noticeBody(invite, instruction),
            message_id: messageId,
            thread_id: threadId,
            intent: 'handoff',
            priority: 'high',
            subject: `Workspace invite: ${workspaceId}`,
            labels: ['handoff', 'task-open', 'work-plane', 'scope-bound'],
            scope: { mode: 'single_chain', chains: ['cairnstone-v6-project-memory'] }
          });
          noticeSent = true;
          inboxStatus = 'delivered';
        } catch (err) {
          inboxStatus = 'unknown';
          toast(`${actor}: invite minted, AC1 send failed (${err.message})`);
        }
        created.push(stripSecrets({
          invite_id: invite.invite_id,
          workspace_id: invite.workspace_id,
          principal_actor_id: invite.principal_actor_id,
          membership_role: invite.membership_role,
          invite_fingerprint: invite.invite_fingerprint,
          message_id: messageId,
          thread_id: threadId,
          notice_sent: noticeSent,
          inbox_status: inboxStatus,
          invite
        }));
      }
      saveTracked([...created, ...loadTracked()].filter((row, i, all) => all.findIndex(x => x.invite_id === row.invite_id) === i));
      render();
      toast(`Minted ${created.length} distinct invite${created.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast(err.message);
    } finally {
      busy(els.mint, false, 'Mint & Send');
    }
  }

  async function composeSend() {
    const to = parseActors(els.composeTo.value);
    const content = els.composeBody.value.trim();
    if (!to.length || !content) return toast('Recipients and message are required');
    busy(els.composeSend, true, 'Sending…');
    try {
      const r = await mcpCall('cairnstone_send_message', {
        from: actorId(),
        to,
        content,
        intent: els.composeIntent.value,
        priority: 'normal',
        subject: els.composeSubject.value.trim() || 'CairnStone Console message',
        labels: ['work-plane', 'informational']
      });
      els.composeResult.textContent = JSON.stringify({
        ok: r.ok,
        message_id: r.message_id || r.metadata?.message_id,
        stone_hash: r.stone_hash,
        accepted_state_authority: false
      }, null, 2);
      toast('Message sent');
    } catch (err) {
      els.composeResult.textContent = JSON.stringify(err.payload || { error: err.message }, null, 2);
      toast(err.message);
    } finally {
      busy(els.composeSend, false, 'Send message');
    }
  }

  els.mint?.addEventListener('click', mintAndSend);
  els.refresh?.addEventListener('click', refreshAll);
  els.copyFallback?.addEventListener('click', () => {
    navigator.clipboard.writeText(els.fallback.value || FALLBACK_PROMPT).then(() => toast('Copied')).catch(() => toast('Copy failed'));
  });
  els.composeSend?.addEventListener('click', composeSend);
  render();
}
