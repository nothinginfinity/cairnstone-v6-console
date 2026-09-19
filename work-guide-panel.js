/**
 * Guided operator Work panel wiring (presentation only).
 * Step visibility + honest Code Session discovery via Conversation Session bindings.
 * Never mints grants, never auto-dispatches, never moves HEADs.
 */

import {
  codeSessionsFromConversationList,
  readWorkGuidePrefs,
  workGuideModel,
  writeWorkGuidePrefs
} from './work-guide.js';

function shortId(id) {
  const s = String(id || '').trim();
  if (!s) return '—';
  if (s.length <= 20) return s;
  return `${s.slice(0, 8)}…${s.slice(-6)}`;
}

function parseRepos(text) {
  return String(text || '')
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseCommits(text) {
  const out = [];
  for (const row of String(text || '').split('\n').map((s) => s.trim()).filter(Boolean)) {
    const parts = row.split(/\s+/);
    if (parts.length < 2) continue;
    out.push({ repo: parts[0], commit_sha: parts[1] });
  }
  return out;
}

export function initWorkGuidePanel(api = {}) {
  const {
    mcpCall,
    toast = () => {},
    busy = () => {},
    esc = (s) => String(s ?? ''),
    actorId = () => '',
    panel = () => {},
    invitePrefill = null
  } = api;

  const els = {
    guideTitle: document.getElementById('workGuideTitle'),
    guideSubtitle: document.getElementById('workGuideSubtitle'),
    guideMissing: document.getElementById('workGuideMissing'),
    guideStepPill: document.getElementById('workGuideStepPill'),
    guidePrimaryCta: document.getElementById('workGuidePrimaryCta'),
    stepCollaborator: document.getElementById('workStepCollaborator'),
    stepCodeSession: document.getElementById('workStepCodeSession'),
    workspaceId: document.getElementById('workWorkspaceId'),
    workspaceCap: document.getElementById('codeWorkspaceCap'),
    workspaceSave: document.getElementById('workWorkspaceSave'),
    addCollaborator: document.getElementById('workAddCollaboratorBtn'),
    collaboratorContinue: document.getElementById('workCollaboratorContinueBtn'),
    codeSelect: document.getElementById('workCodeSessionSelect'),
    codeRefresh: document.getElementById('workCodeSessionRefreshBtn'),
    codeUse: document.getElementById('workCodeSessionUseBtn'),
    codeSessionId: document.getElementById('codeSessionId'),
    discoveryNote: document.getElementById('workCodeSessionDiscoveryNote'),
    createId: document.getElementById('workCodeSessionCreateId'),
    createRepos: document.getElementById('workCodeSessionCreateRepos'),
    createCommits: document.getElementById('workCodeSessionCreateCommits'),
    createBtn: document.getElementById('workCodeSessionCreateBtn'),
    stageIntent: document.getElementById('workStageIntent'),
    stageEvents: document.getElementById('workStageEvents'),
    stageRetention: document.getElementById('workStageRetention'),
    intentText: document.getElementById('intentText'),
    dispatchTaskRunId: document.getElementById('dispatchTaskRunId')
  };

  let codeSessionLoaded = false;
  let proposalCommitted = false;
  let dispatched = false;

  const prefs0 = readWorkGuidePrefs();
  if (els.workspaceId && prefs0.workspaceId) els.workspaceId.value = prefs0.workspaceId;

  function syncInviteWorkspace(workspaceId) {
    const inviteField = document.getElementById('inviteWorkspace');
    if (inviteField && workspaceId) inviteField.value = workspaceId;
  }

  function gatherState() {
    const p = readWorkGuidePrefs();
    return {
      workspaceId: (els.workspaceId?.value || p.workspaceId || '').trim(),
      hasWorkspaceCapability: Boolean((els.workspaceCap?.value || '').trim()),
      collaboratorStepDone: Boolean(p.collaboratorStepDone),
      codeSessionId: (els.codeSessionId?.value || '').trim(),
      codeSessionLoaded,
      codeSessionFromDiscovery: Boolean(p.codeSessionFromDiscovery),
      workDescription: (els.intentText?.value || '').trim(),
      proposalCommitted,
      taskRunId: (els.dispatchTaskRunId?.value || '').trim(),
      dispatched
    };
  }

  function applyVisibility(model) {
    const v = model.visibility;
    els.stepCollaborator?.classList.toggle('hidden', !v.collaborator);
    els.stepCodeSession?.classList.toggle('hidden', !v.codeSession);
    els.stageIntent?.classList.toggle('hidden', !v.describe);
    els.stageEvents?.classList.toggle('hidden', !v.events);
    els.stageRetention?.classList.toggle('hidden', !v.retention);
  }

  function renderGuide() {
    const model = workGuideModel(gatherState());
    if (els.guideTitle) els.guideTitle.textContent = model.title;
    if (els.guideSubtitle) {
      els.guideSubtitle.textContent = model.flags.allDone
        ? model.subtitle
        : `${model.subtitle} — ${model.missing[0] || ''}`.replace(/\s+—\s+$/, '');
    }
    if (els.guideStepPill) {
      els.guideStepPill.textContent = model.flags.allDone ? 'Ready' : `Step ${model.stepNumber}`;
    }
    if (els.guideMissing) {
      els.guideMissing.innerHTML = model.missing.length
        ? model.missing.map((line) => `<li>${esc(line)}</li>`).join('')
        : '<li>All guided steps satisfied for this browser session.</li>';
    }
    if (els.guidePrimaryCta) {
      els.guidePrimaryCta.textContent = model.primaryCta.label;
      els.guidePrimaryCta.dataset.action = model.primaryCta.action;
    }
    applyVisibility(model);
    return model;
  }

  function saveWorkspace() {
    const workspaceId = (els.workspaceId?.value || '').trim();
    const cap = (els.workspaceCap?.value || '').trim();
    if (!workspaceId) return toast('Workspace ID is required');
    if (!cap) return toast('Workspace capability is required (session only; never stoned)');
    writeWorkGuidePrefs({ workspaceId });
    try { sessionStorage.setItem('cs.workspaceCapability', cap); } catch { /* ignore */ }
    // Keep Code Session panel's existing CAP_STORE_KEY in sync when present.
    try { sessionStorage.setItem('cs.workspaceCapability', cap); } catch { /* ignore */ }
    syncInviteWorkspace(workspaceId);
    toast('Workspace saved for this browser session');
    renderGuide();
  }

  function addCollaborator() {
    const workspaceId = (els.workspaceId?.value || readWorkGuidePrefs().workspaceId || '').trim();
    if (!workspaceId) return toast('Save a workspace first');
    syncInviteWorkspace(workspaceId);
    if (typeof invitePrefill === 'function') {
      invitePrefill({
        workspaceId,
        instruction: 'Join this workspace and claim with your mailbox capability. Do not paste workspace bearers into Stones or chat.',
        fallback: 'Check your CairnStone inbox for the workspace invite.'
      });
    }
    writeWorkGuidePrefs({ collaboratorStepDone: true });
    panel('invite');
    toast('Invite plane opened — Add collaborator (not Share reference)');
    renderGuide();
  }

  function continueAfterCollaborator() {
    writeWorkGuidePrefs({ collaboratorStepDone: true });
    toast('Collaborator step marked done — next: Code Session');
    renderGuide();
    void refreshDiscovery();
  }

  function renderDiscoveryOptions(options, { error = null } = {}) {
    if (!els.codeSelect) return;
    if (error) {
      els.codeSelect.innerHTML = '<option value="">Discovery unavailable — use Create or Advanced</option>';
      if (els.discoveryNote) {
        els.discoveryNote.textContent = `Honest discovery failed: ${error.message || error}. Console will not invent Code Session IDs.`;
      }
      return;
    }
    if (!options.length) {
      els.codeSelect.innerHTML = '<option value="">No bound Code Sessions found</option>';
      if (els.discoveryNote) {
        els.discoveryNote.textContent = 'No Conversation Session currently binds a code_session_id for this actor. Create one below, or use Advanced only as an escape hatch.';
      }
      return;
    }
    els.codeSelect.innerHTML = [
      '<option value="">Select a bound Code Session…</option>',
      ...options.map((o) => `<option value="${esc(o.codeSessionId)}">${esc(o.label)}</option>`)
    ].join('');
    if (els.discoveryNote) {
      els.discoveryNote.textContent = `${options.length} Code Session${options.length === 1 ? '' : 's'} discovered via Conversation Session bindings.`;
    }
  }

  async function refreshDiscovery() {
    const actor = typeof actorId === 'function' ? actorId() : '';
    if (!actor) {
      renderDiscoveryOptions([], { error: new Error('Actor ID required') });
      return;
    }
    busy(els.codeRefresh, true, '…');
    try {
      const data = await mcpCall('cairnstone_conversation_session_list', {
        actor_id: actor,
        limit: 50
      });
      const options = codeSessionsFromConversationList(data);
      renderDiscoveryOptions(options);
      toast(options.length
        ? `Found ${options.length} bound Code Session${options.length === 1 ? '' : 's'}`
        : 'No bound Code Sessions yet');
    } catch (err) {
      renderDiscoveryOptions([], { error: err });
      toast(err.message || 'Conversation Session list unavailable');
    } finally {
      busy(els.codeRefresh, false, 'Refresh discovery');
      renderGuide();
    }
  }

  function useSelectedCodeSession() {
    const id = (els.codeSelect?.value || '').trim();
    if (!id) return toast('Select a discovered Code Session first');
    if (els.codeSessionId) els.codeSessionId.value = id;
    try { sessionStorage.setItem('cs.codeSessionId', id); } catch { /* ignore */ }
    writeWorkGuidePrefs({ codeSessionFromDiscovery: true });
    // Trigger change so code-session panel persists.
    els.codeSessionId?.dispatchEvent(new Event('change'));
    toast(`Code Session selected via Conversation binding · ${shortId(id)}`);
    renderGuide();
  }

  async function createCodeSession() {
    const workspaceId = (els.workspaceId?.value || readWorkGuidePrefs().workspaceId || '').trim();
    const workspaceCapability = (els.workspaceCap?.value || '').trim();
    const actor = typeof actorId === 'function' ? actorId() : '';
    const codeSessionId = (els.createId?.value || '').trim();
    const sourceRepos = parseRepos(els.createRepos?.value);
    const baseCommits = parseCommits(els.createCommits?.value);

    if (!workspaceId) return toast('Workspace ID required');
    if (!workspaceCapability) return toast('Workspace capability required (session only)');
    if (!actor) return toast('Actor ID required');
    if (!codeSessionId) return toast('New Code Session ID required');
    if (!sourceRepos.length) return toast('At least one source repo is required');
    if (!baseCommits.length) return toast('Base commits required as: repo sha');

    busy(els.createBtn, true, 'Creating…');
    try {
      const data = await mcpCall('cairnstone_code_session_create', {
        code_session_id: codeSessionId,
        workspace_id: workspaceId,
        created_by: actor,
        workspace_capability: workspaceCapability,
        source_repos: sourceRepos,
        base_commits: baseCommits
      });
      if (data?.ok === false) throw new Error(data.error || 'create_failed');
      const createdId = data.code_session_id
        || data.persistent_code_session?.code_session_id
        || codeSessionId;
      if (els.codeSessionId) els.codeSessionId.value = createdId;
      try { sessionStorage.setItem('cs.codeSessionId', createdId); } catch { /* ignore */ }
      writeWorkGuidePrefs({ codeSessionFromDiscovery: true });
      els.codeSessionId?.dispatchEvent(new Event('change'));
      toast(`Code Session created · ${shortId(createdId)}`);
      renderGuide();
      await refreshDiscovery();
    } catch (err) {
      toast(err.message || 'Create Code Session failed — fail closed');
    } finally {
      busy(els.createBtn, false, 'Create Code Session');
    }
  }

  function runPrimaryCta() {
    const action = els.guidePrimaryCta?.dataset.action || workGuideModel(gatherState()).primaryCta.action;
    switch (action) {
      case 'save_workspace':
        return saveWorkspace();
      case 'add_collaborator':
        return addCollaborator();
      case 'focus_code_session':
        els.stepCodeSession?.classList.remove('hidden');
        els.codeSelect?.focus();
        return void refreshDiscovery();
      case 'focus_describe':
        els.stageIntent?.classList.remove('hidden');
        els.intentText?.focus();
        return;
      case 'focus_review':
        els.stageIntent?.classList.remove('hidden');
        document.getElementById('intentRouteButton')?.focus();
        return;
      case 'focus_dispatch':
        els.stageIntent?.classList.remove('hidden');
        els.stageEvents?.classList.remove('hidden');
        document.getElementById('dispatchCommitButton')?.focus();
        return;
      default:
        return;
    }
  }

  function markCodeSessionLoaded(loaded) {
    codeSessionLoaded = Boolean(loaded);
    if (loaded) writeWorkGuidePrefs({ codeSessionFromDiscovery: true });
    renderGuide();
  }

  function markProposalCommitted(done) {
    proposalCommitted = Boolean(done);
    renderGuide();
  }

  function markDispatched(done) {
    dispatched = Boolean(done);
    renderGuide();
  }

  els.workspaceSave?.addEventListener('click', saveWorkspace);
  els.workspaceId?.addEventListener('change', () => {
    writeWorkGuidePrefs({ workspaceId: (els.workspaceId.value || '').trim() });
    renderGuide();
  });
  els.workspaceCap?.addEventListener('input', () => renderGuide());
  els.addCollaborator?.addEventListener('click', addCollaborator);
  els.collaboratorContinue?.addEventListener('click', continueAfterCollaborator);
  els.codeRefresh?.addEventListener('click', () => void refreshDiscovery());
  els.codeUse?.addEventListener('click', useSelectedCodeSession);
  els.createBtn?.addEventListener('click', () => void createCodeSession());
  els.guidePrimaryCta?.addEventListener('click', runPrimaryCta);
  els.intentText?.addEventListener('input', () => renderGuide());
  els.dispatchTaskRunId?.addEventListener('input', () => renderGuide());
  els.codeSessionId?.addEventListener('change', () => {
    // Manual Advanced entry is an escape hatch — not discovery.
    writeWorkGuidePrefs({ codeSessionFromDiscovery: false });
    renderGuide();
  });

  window.addEventListener('cairn:work-code-session-loaded', (ev) => {
    markCodeSessionLoaded(ev?.detail?.ok !== false);
  });
  window.addEventListener('cairn:work-proposal-committed', () => markProposalCommitted(true));
  window.addEventListener('cairn:work-dispatched', () => markDispatched(true));

  renderGuide();
  if (readWorkGuidePrefs().collaboratorStepDone) void refreshDiscovery();

  return {
    refresh: renderGuide,
    refreshDiscovery,
    markCodeSessionLoaded,
    markProposalCommitted,
    markDispatched,
    gatherState
  };
}
