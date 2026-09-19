/**
 * Zero-ID questionnaire Work panel wiring (presentation only).
 * Human answers what / who / what should they do; CairnStone auto-resolves
 * workspace, access readiness, Code Session, pins, IDs, Task Run + events.
 * Never mints grants, never auto-dispatches, never moves HEADs, never weakens scoped_grant.
 */

import { SEED_ACTORS } from './actor-inbox-nav.js';
import {
  WORK_ACTION_CHOICES,
  buildAutoResolveSnapshot,
  codeSessionsFromConversationList,
  composeIntentFromAnswers,
  humanActorOptions,
  questionnaireModel,
  readWorkGuidePrefs,
  redactRawSha,
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

function statusClass(status) {
  if (status === 'resolved') return 'ok';
  if (status === 'blocked') return 'bad';
  if (status === 'resolving') return 'busy';
  return 'pending';
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
    guideHint: document.getElementById('workGuideHint'),
    guideMissing: document.getElementById('workGuideMissing'),
    guideStepPill: document.getElementById('workGuideStepPill'),
    guidePrimaryCta: document.getElementById('workGuidePrimaryCta'),
    guideBack: document.getElementById('workGuideBackBtn'),
    qWhat: document.getElementById('workQuestionWhat'),
    qWho: document.getElementById('workQuestionWho'),
    qAction: document.getElementById('workQuestionAction'),
    answerWhat: document.getElementById('workAnswerWhat'),
    actorPicker: document.getElementById('workActorPicker'),
    whoSelected: document.getElementById('workWhoSelected'),
    actionChoices: document.getElementById('workActionChoices'),
    actionNoteWrap: document.getElementById('workActionNoteWrap'),
    actionNote: document.getElementById('workAnswerActionNote'),
    resolveCard: document.getElementById('workAutoResolveCard'),
    resolveList: document.getElementById('workAutoResolveList'),
    resolveRefresh: document.getElementById('workAutoResolveRefresh'),
    confirmCard: document.getElementById('workConfirmCard'),
    advancedShell: document.getElementById('workAdvancedShell'),
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
  let proposalReady = false;
  let dispatched = false;
  let questionIndex = 0;
  let answers = { ...(readWorkGuidePrefs().answers || {}) };
  let autoResolve = { ...(readWorkGuidePrefs().autoResolve || {}) };
  let discoveredSessions = [];
  let resolving = false;
  let consoleViewKickoffDone = false;

  const prefs0 = readWorkGuidePrefs();
  if (els.workspaceId && prefs0.workspaceId) els.workspaceId.value = prefs0.workspaceId;
  if (els.answerWhat && answers.what) els.answerWhat.value = answers.what;
  if (els.actionNote && answers.actionNote) els.actionNote.value = answers.actionNote;
  if (answers.what && answers.whoMailboxId && (answers.actionId || answers.actionLabel)) {
    questionIndex = 3;
  } else if (answers.what && answers.whoMailboxId) {
    questionIndex = 2;
  } else if (answers.what) {
    questionIndex = 1;
  }

  function syncInviteWorkspace(workspaceId) {
    const inviteField = document.getElementById('inviteWorkspace');
    if (inviteField && workspaceId) inviteField.value = workspaceId;
  }

  function persistAnswers() {
    writeWorkGuidePrefs({ answers, autoResolve });
  }

  function gatherQuestionnaireInput() {
    return {
      answers,
      questionIndex,
      autoResolve,
      proposalReady,
      proposalCommitted,
      dispatched,
      taskRunId: (els.dispatchTaskRunId?.value || '').trim(),
      codeSessionLoaded,
      advancedOpen: Boolean(els.advancedShell?.open),
      extraActors: []
    };
  }

  function applyVisibility(model) {
    const v = model.visibility;
    const qId = model.currentQuestionId;
    els.qWhat?.classList.toggle('hidden', qId !== 'what');
    els.qWho?.classList.toggle('hidden', qId !== 'who');
    els.qAction?.classList.toggle('hidden', qId !== 'what_should_they_do');
    els.resolveCard?.classList.toggle('hidden', !v.autoResolve);
    els.confirmCard?.classList.toggle('hidden', !v.confirm && !model.allAnswered);
    if (model.allAnswered) els.confirmCard?.classList.remove('hidden');
    els.stageEvents?.classList.toggle('hidden', !v.events);
    els.stageRetention?.classList.toggle('hidden', !v.retention);
    els.guideBack?.classList.toggle('hidden', model.questionNumber <= 1 && !model.allAnswered);
  }

  function renderActorPicker(model) {
    if (!els.actorPicker) return;
    const options = model.actorOptions?.length ? model.actorOptions : humanActorOptions();
    const selected = String(answers.whoMailboxId || '').trim();
    els.actorPicker.innerHTML = options.map((opt) => {
      const active = opt.mailboxId === selected ? ' active' : '';
      return `<button type="button" class="actor-chip${active}" role="option" aria-selected="${opt.mailboxId === selected}" data-mailbox="${esc(opt.mailboxId)}" data-display="${esc(opt.display)}" data-key="${esc(opt.key)}">${esc(opt.display)}</button>`;
    }).join('');
    if (els.whoSelected) {
      els.whoSelected.textContent = selected
        ? `Selected: ${answers.whoDisplay || selected}`
        : 'No one selected yet.';
    }
  }

  function renderActionChoices() {
    if (!els.actionChoices) return;
    const selected = String(answers.actionId || '').trim();
    els.actionChoices.innerHTML = WORK_ACTION_CHOICES.map((choice) => {
      const active = choice.id === selected ? ' active' : '';
      return `<button type="button" class="work-action-chip${active}" role="option" aria-selected="${choice.id === selected}" data-action-id="${esc(choice.id)}" data-label="${esc(choice.label)}">${esc(choice.label)}</button>`;
    }).join('');
    const showNote = selected === 'custom' || Boolean(answers.actionNote);
    els.actionNoteWrap?.classList.toggle('hidden', !showNote && selected !== 'custom');
  }

  function renderAutoResolveList(model) {
    if (!els.resolveList) return;
    const steps = model.autoResolveSteps || [];
    els.resolveList.innerHTML = steps.map((step) => {
      const row = model.autoResolve?.[step.id] || {};
      const status = row.status || 'pending';
      const detail = redactRawSha(row.detail || step.missing);
      return `<li class="work-resolve-item status-${esc(statusClass(status))}" data-resolve="${esc(step.id)}">
        <div class="work-resolve-head"><strong>${esc(step.label)}</strong><span class="work-resolve-status">${esc(status)}</span></div>
        <div class="muted small">${esc(detail)}</div>
      </li>`;
    }).join('');
  }

  function renderGuide() {
    const model = questionnaireModel(gatherQuestionnaireInput());
    if (els.guideTitle) els.guideTitle.textContent = model.title;
    if (els.guideSubtitle) els.guideSubtitle.textContent = model.subtitle;
    if (els.guideHint) {
      els.guideHint.textContent = model.hint || '';
      els.guideHint.classList.toggle('hidden', !model.hint);
    }
    if (els.guideStepPill) {
      const pill = model.allAnswered
        ? (model.phase === 'watch' ? 'Ready' : 'Resolve')
        : (model.questions.find((q) => q.id === model.currentQuestionId)?.title || 'Work');
      els.guideStepPill.textContent = pill;
    }
    if (els.guideMissing) {
      if (!model.allAnswered) {
        els.guideMissing.innerHTML = `<li>${esc(model.hint || model.subtitle)}</li>`;
      } else if (model.resolveBlocked) {
        els.guideMissing.innerHTML = '<li>Some CairnStone values are blocked — open Advanced only if honest discovery cannot finish.</li>';
      } else {
        els.guideMissing.innerHTML = '<li>Human answers captured. Human Commit and Dispatch remain second taps.</li>';
      }
    }
    if (els.guidePrimaryCta) {
      els.guidePrimaryCta.textContent = model.primaryCta.label;
      els.guidePrimaryCta.dataset.action = model.primaryCta.action;
      els.guidePrimaryCta.disabled = model.primaryCta.action === 'noop_resolving' || resolving;
    }
    renderActorPicker(model);
    renderActionChoices();
    renderAutoResolveList(model);
    applyVisibility(model);

    if (model.allAnswered && els.intentText) {
      const composed = composeIntentFromAnswers(answers);
      if (composed && (!els.intentText.value.trim() || els.intentText.dataset.fromQuestionnaire === '1')) {
        els.intentText.value = composed;
        els.intentText.dataset.fromQuestionnaire = '1';
        els.intentText.dispatchEvent(new Event('input'));
      }
    }
    return model;
  }

  function selectWho(mailboxId, display, key) {
    answers = {
      ...answers,
      whoMailboxId: mailboxId,
      whoDisplay: display,
      whoKey: key,
      who: display
    };
    persistAnswers();
    renderGuide();
  }

  function selectAction(actionId, label) {
    answers = {
      ...answers,
      actionId,
      actionLabel: label,
      what_should_they_do: label
    };
    persistAnswers();
    renderGuide();
  }

  function answerCurrentAndAdvance() {
    const model = questionnaireModel(gatherQuestionnaireInput());
    const qid = model.currentQuestionId;
    if (qid === 'what') {
      const what = (els.answerWhat?.value || '').trim();
      if (!what) return toast('Describe the work in plain language first');
      answers = { ...answers, what };
      questionIndex = 1;
      persistAnswers();
      renderGuide();
      return;
    }
    if (qid === 'who') {
      if (!String(answers.whoMailboxId || '').trim()) return toast('Pick who by name');
      questionIndex = 2;
      persistAnswers();
      renderGuide();
      return;
    }
    if (qid === 'what_should_they_do') {
      if (!String(answers.actionId || answers.actionLabel || '').trim()) {
        return toast('Choose what they should do');
      }
      if (answers.actionId === 'custom') {
        const note = (els.actionNote?.value || '').trim();
        if (!note) return toast('Add a plain-language note for the custom action');
        answers = { ...answers, actionNote: note, actionLabel: note, what_should_they_do: note };
      } else {
        answers = { ...answers, actionNote: (els.actionNote?.value || '').trim() };
      }
      questionIndex = 3;
      persistAnswers();
      renderGuide();
      void runAutoResolve();
      return;
    }
    if (model.allAnswered) {
      void runAutoResolve();
    }
  }

  function goBack() {
    if (questionIndex > 0) {
      questionIndex = Math.max(0, questionIndex - 1);
      renderGuide();
    }
  }

  async function discoverBoundSessions() {
    const actor = typeof actorId === 'function' ? actorId() : '';
    if (!actor) throw new Error('Actor ID required for Conversation Session discovery');
    const data = await mcpCall('cairnstone_conversation_session_list', {
      actor_id: actor,
      limit: 50
    });
    discoveredSessions = codeSessionsFromConversationList(data);
    return discoveredSessions;
  }

  async function hydratePinsFromCodeSession(codeSessionId, workspaceCapability) {
    const actor = typeof actorId === 'function' ? actorId() : '';
    if (!codeSessionId || !workspaceCapability || !actor) {
      return { sourceRepos: [], baseCommits: [] };
    }
    try {
      const data = await mcpCall('cairnstone_code_session_get', {
        code_session_id: codeSessionId,
        actor_id: actor,
        workspace_capability: workspaceCapability
      });
      const session = data?.persistent_code_session
        || data?.code_session
        || data?.session
        || data;
      const sourceRepos = Array.isArray(session?.source_repos)
        ? session.source_repos.map((r) => String(r || '').trim()).filter(Boolean)
        : [];
      const baseCommits = Array.isArray(session?.base_commits)
        ? session.base_commits.map((entry) => ({
          repo: String(entry?.repo || entry?.repository || '').trim(),
          commit_sha: String(entry?.commit_sha || entry?.sha || '').trim() || null
        })).filter((e) => e.repo)
        : [];
      return { sourceRepos, baseCommits };
    } catch {
      return { sourceRepos: [], baseCommits: [] };
    }
  }

  async function runAutoResolve() {
    if (resolving) return;
    resolving = true;
    renderGuide();
    toast('Resolving CairnStone values…');
    try {
      const prefs = readWorkGuidePrefs();
      let workspaceId = (els.workspaceId?.value || prefs.workspaceId || '').trim();
      const hasWorkspaceCapability = Boolean((els.workspaceCap?.value || '').trim());
      let sessions = [];
      try {
        sessions = await discoverBoundSessions();
        renderDiscoveryOptions(sessions);
      } catch (err) {
        renderDiscoveryOptions([], { error: err });
        toast(err.message || 'Conversation Session list unavailable');
      }

      const best = sessions[0] || null;
      if (best?.workspaceId && !workspaceId) {
        workspaceId = best.workspaceId;
        if (els.workspaceId) els.workspaceId.value = workspaceId;
        writeWorkGuidePrefs({ workspaceId });
        syncInviteWorkspace(workspaceId);
      }

      if (best?.codeSessionId) {
        if (els.codeSessionId) els.codeSessionId.value = best.codeSessionId;
        try { sessionStorage.setItem('cs.codeSessionId', best.codeSessionId); } catch { /* ignore */ }
        writeWorkGuidePrefs({ codeSessionFromDiscovery: true });
        els.codeSessionId?.dispatchEvent(new Event('change'));
      }

      const workspaceCapability = (els.workspaceCap?.value || '').trim();
      let sourceRepos = best?.sourceRepos || [];
      let baseCommits = best?.baseCommits || [];
      if (best?.codeSessionId && workspaceCapability) {
        const hydrated = await hydratePinsFromCodeSession(best.codeSessionId, workspaceCapability);
        if (hydrated.sourceRepos.length) sourceRepos = hydrated.sourceRepos;
        if (hydrated.baseCommits.length) baseCommits = hydrated.baseCommits;
      }

      const taskRunId = (els.dispatchTaskRunId?.value || '').trim();
      autoResolve = buildAutoResolveSnapshot({
        workspaceId,
        hasWorkspaceCapability,
        codeSession: best,
        sourceRepos,
        baseCommits,
        taskRunId,
        proposalReady,
        eventsReady: proposalReady || Boolean(taskRunId),
        idBundle: {
          workspace_id: workspaceId,
          code_session_id: best?.codeSessionId || null,
          conversation_id: best?.conversationId || null,
          task_run_id: taskRunId || null
        }
      });
      persistAnswers();

      // Compose intent into the confirm card; do NOT auto route / commit / dispatch.
      if (els.intentText) {
        els.intentText.value = composeIntentFromAnswers(answers);
        els.intentText.dataset.fromQuestionnaire = '1';
        els.intentText.dispatchEvent(new Event('input'));
      }

      if (best?.codeSessionId && hasWorkspaceCapability && !consoleViewKickoffDone) {
        // Soft-load console view once; failures stay honest. Do not re-enter resolve from the load event.
        consoleViewKickoffDone = true;
        document.getElementById('codeLoad')?.click();
      }

      toast(best?.codeSessionId
        ? 'Resolved from Conversation bindings — review before Human Commit'
        : 'Partial resolve — check Advanced if discovery cannot finish');
    } finally {
      resolving = false;
      renderGuide();
    }
  }

  function saveWorkspace() {
    const workspaceId = (els.workspaceId?.value || '').trim();
    const cap = (els.workspaceCap?.value || '').trim();
    if (!workspaceId) return toast('Workspace ID is required');
    if (!cap) return toast('Workspace capability is required (session only; never stoned)');
    writeWorkGuidePrefs({ workspaceId });
    try { sessionStorage.setItem('cs.workspaceCapability', cap); } catch { /* ignore */ }
    syncInviteWorkspace(workspaceId);
    toast('Workspace saved for this browser session');
    if (questionnaireModel(gatherQuestionnaireInput()).allAnswered) void runAutoResolve();
    else renderGuide();
  }

  function addCollaborator() {
    const workspaceId = (els.workspaceId?.value || readWorkGuidePrefs().workspaceId || '').trim();
    if (!workspaceId) return toast('Save a workspace first (Advanced) or resolve one');
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
    toast('Collaborator step marked done');
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
      const options = await discoverBoundSessions();
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
    els.codeSessionId?.dispatchEvent(new Event('change'));
    toast(`Code Session selected via Conversation binding · ${shortId(id)}`);
    if (questionnaireModel(gatherQuestionnaireInput()).allAnswered) void runAutoResolve();
    else renderGuide();
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
      await refreshDiscovery();
      if (questionnaireModel(gatherQuestionnaireInput()).allAnswered) await runAutoResolve();
      else renderGuide();
    } catch (err) {
      toast(err.message || 'Create Code Session failed — fail closed');
    } finally {
      busy(els.createBtn, false, 'Create Code Session');
    }
  }

  function runPrimaryCta() {
    const action = els.guidePrimaryCta?.dataset.action
      || questionnaireModel(gatherQuestionnaireInput()).primaryCta.action;
    switch (action) {
      case 'answer_what':
      case 'answer_who':
      case 'answer_action':
        return answerCurrentAndAdvance();
      case 'run_auto_resolve':
        return void runAutoResolve();
      case 'noop_resolving':
        return;
      case 'save_workspace':
        return saveWorkspace();
      case 'add_collaborator':
        return addCollaborator();
      case 'focus_code_session':
        if (els.advancedShell) els.advancedShell.open = true;
        els.codeSelect?.focus();
        return void refreshDiscovery();
      case 'focus_describe':
      case 'focus_review':
        els.confirmCard?.classList.remove('hidden');
        els.confirmCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('intentRouteButton')?.focus();
        return;
      case 'focus_dispatch':
        els.confirmCard?.classList.remove('hidden');
        els.stageEvents?.classList.remove('hidden');
        document.getElementById('dispatchCommitButton')?.focus();
        return;
      default:
        return answerCurrentAndAdvance();
    }
  }

  function markCodeSessionLoaded(loaded) {
    codeSessionLoaded = Boolean(loaded);
    if (loaded) writeWorkGuidePrefs({ codeSessionFromDiscovery: true });
    renderGuide();
  }

  function markProposalCommitted(done) {
    proposalCommitted = Boolean(done);
    proposalReady = true;
    const taskRunId = (els.dispatchTaskRunId?.value || '').trim();
    if (taskRunId || done) {
      autoResolve = {
        ...autoResolve,
        ...buildAutoResolveSnapshot({
          workspaceId: (els.workspaceId?.value || readWorkGuidePrefs().workspaceId || '').trim(),
          hasWorkspaceCapability: Boolean((els.workspaceCap?.value || '').trim()),
          codeSession: discoveredSessions[0] || {
            codeSessionId: (els.codeSessionId?.value || '').trim() || null
          },
          sourceRepos: discoveredSessions[0]?.sourceRepos || [],
          baseCommits: discoveredSessions[0]?.baseCommits || [],
          taskRunId,
          proposalReady: true,
          eventsReady: true
        })
      };
      persistAnswers();
    }
    renderGuide();
  }

  function markProposalReady(done) {
    proposalReady = Boolean(done);
    if (done) {
      autoResolve = {
        ...autoResolve,
        task_run_events: {
          status: 'resolved',
          detail: 'Proposal / events surface ready — Human Commit / Dispatch still second-tap',
          value: 'proposal_ready'
        }
      };
      persistAnswers();
    }
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
  els.workspaceCap?.addEventListener('input', () => {
    if (questionnaireModel(gatherQuestionnaireInput()).allAnswered) void runAutoResolve();
    else renderGuide();
  });
  els.addCollaborator?.addEventListener('click', addCollaborator);
  els.collaboratorContinue?.addEventListener('click', continueAfterCollaborator);
  els.codeRefresh?.addEventListener('click', () => void refreshDiscovery());
  els.codeUse?.addEventListener('click', useSelectedCodeSession);
  els.createBtn?.addEventListener('click', () => void createCodeSession());
  els.guidePrimaryCta?.addEventListener('click', runPrimaryCta);
  els.guideBack?.addEventListener('click', goBack);
  els.resolveRefresh?.addEventListener('click', () => void runAutoResolve());
  els.answerWhat?.addEventListener('input', () => {
    answers = { ...answers, what: (els.answerWhat.value || '').trim() };
    persistAnswers();
  });
  els.actionNote?.addEventListener('input', () => {
    answers = { ...answers, actionNote: (els.actionNote.value || '').trim() };
    persistAnswers();
  });
  els.actorPicker?.addEventListener('click', (ev) => {
    const btn = ev.target?.closest?.('[data-mailbox]');
    if (!btn) return;
    selectWho(btn.dataset.mailbox, btn.dataset.display, btn.dataset.key);
  });
  els.actionChoices?.addEventListener('click', (ev) => {
    const btn = ev.target?.closest?.('[data-action-id]');
    if (!btn) return;
    selectAction(btn.dataset.actionId, btn.dataset.label);
  });
  els.intentText?.addEventListener('input', () => {
    if (els.intentText.dataset.fromQuestionnaire === '1') {
      // User edits leave questionnaire composition; still re-render.
      delete els.intentText.dataset.fromQuestionnaire;
    }
    renderGuide();
  });
  els.dispatchTaskRunId?.addEventListener('input', () => renderGuide());
  els.codeSessionId?.addEventListener('change', () => {
    // Manual Advanced entry is an escape hatch — not discovery.
    writeWorkGuidePrefs({ codeSessionFromDiscovery: false });
    renderGuide();
  });
  els.advancedShell?.addEventListener('toggle', () => renderGuide());

  window.addEventListener('cairn:work-code-session-loaded', (ev) => {
    markCodeSessionLoaded(ev?.detail?.ok !== false);
  });
  window.addEventListener('cairn:work-proposal-ready', () => markProposalReady(true));
  window.addEventListener('cairn:work-proposal-committed', () => markProposalCommitted(true));
  window.addEventListener('cairn:work-dispatched', () => markDispatched(true));

  // Seed actor chips even before first paint of who-question.
  if (!SEED_ACTORS.length) {
    /* directory empty — Advanced custom IDs remain available elsewhere */
  }

  renderGuide();
  if (questionnaireModel(gatherQuestionnaireInput()).allAnswered) void runAutoResolve();

  return {
    refresh: renderGuide,
    refreshDiscovery,
    runAutoResolve,
    markCodeSessionLoaded,
    markProposalCommitted,
    markProposalReady,
    markDispatched,
    gatherState: gatherQuestionnaireInput
  };
}
