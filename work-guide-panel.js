/**
 * Zero-ID questionnaire Work panel (presentation only).
 * Humans answer what / who / what should they do; CairnStone auto-resolves
 * workspace, access readiness, Code Session, pins, IDs, Task Run + events.
 * Never mints grants, never auto-dispatches, never moves HEADs, never weakens scoped_grant.
 */

import {
  WORK_ACTION_CHOICES,
  accessGrantConfirmPrompt,
  accessTargetChoicesFromDiscovery,
  buildAutoResolveSnapshot,
  codeSessionsFromConversationList,
  composeIntentFromAnswers,
  conversationRefsFromList,
  extractResolvedCommitSha,
  humanActorOptions,
  isLightweightResolveAction,
  mintCodeSessionId,
  needsAccessTargetQuestion,
  parseRepoPick,
  questionnaireModel,
  readWorkGuidePrefs,
  redactRawSha,
  resolvingAutoResolvePlaceholder,
  writeWorkGuidePrefs
} from './work-guide.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

export function initWorkGuidePanel(api = {}) {
  const {
    mcpCall,
    toast = () => {},
    busy = () => {},
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
    codeSessionCard: document.getElementById('workCodeSessionCard'),
    codeSessionStatus: document.getElementById('workCodeSessionStatus'),
    repoBranchPick: document.getElementById('workRepoBranchPick'),
    repoPick: document.getElementById('workRepoPick'),
    branchPick: document.getElementById('workBranchPick'),
    repoBranchBindBtn: document.getElementById('workRepoBranchBindBtn'),
    repoBranchNote: document.getElementById('workRepoBranchNote'),
    accessTargetPick: document.getElementById('workAccessTargetPick'),
    accessTargetChoices: document.getElementById('workAccessTargetChoices'),
    accessTargetNote: document.getElementById('workAccessTargetNote'),
    accessConfirm: document.getElementById('workAccessConfirm'),
    accessConfirmText: document.getElementById('workAccessConfirmText'),
    accessConfirmCheck: document.getElementById('workAccessConfirmCheck'),
    codeLoad: document.getElementById('codeLoad'),
    codeSurface: document.getElementById('codeSurface'),
    advancedShell: document.getElementById('workAdvancedShell'),
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
    stageEvents: document.getElementById('workStageEvents'),
    stageRetention: document.getElementById('workStageRetention'),
    intentText: document.getElementById('intentText'),
    intentHumanCommit: document.getElementById('intentHumanCommit'),
    intentCommitProposal: document.getElementById('intentCommitProposal'),
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
  let applyingBoundSession = false;
  let workspaceHumanMeta = { conversationTitle: '', projectName: '', fromPrefs: false };
  let needsRepoBranchPick = false;
  let needsAccessTargetPick = false;
  let accessTargetChoices = [];
  let conversationRefs = [];
  let accessConfirmAccepted = Boolean(answers.accessConfirmAccepted);
  let lastMcpTimeout = false;

  const prefs0 = readWorkGuidePrefs();
  if (els.workspaceId && prefs0.workspaceId) {
    els.workspaceId.value = prefs0.workspaceId;
    workspaceHumanMeta.fromPrefs = true;
  }
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

  function gatherInput() {
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

  function softScrollToCodeSession() {
    const target = els.codeSurface?.classList.contains('hidden') === false
      ? els.codeSurface
      : els.codeSessionCard;
    if (!target || typeof target.scrollIntoView !== 'function') return;
    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      /* ignore */
    }
  }

  function applyVisibility(model) {
    const qId = model.currentQuestionId;
    els.qWhat?.classList.toggle('hidden', qId !== 'what');
    els.qWho?.classList.toggle('hidden', qId !== 'who');
    els.qAction?.classList.toggle('hidden', qId !== 'what_should_they_do');
    els.resolveCard?.classList.toggle('hidden', !model.allAnswered);
    els.confirmCard?.classList.toggle('hidden', !model.allAnswered);
    els.codeSessionCard?.classList.toggle('hidden', !model.allAnswered);
    const lightweight = isLightweightResolveAction(answers.actionId);
    els.repoBranchPick?.classList.toggle('hidden', !(model.allAnswered && needsRepoBranchPick && !lightweight));
    els.accessTargetPick?.classList.toggle('hidden', !(model.allAnswered && needsAccessTargetPick && lightweight));
    els.accessConfirm?.classList.toggle('hidden', !(model.allAnswered && answers.actionId === 'give_access' && answers.accessTargetId && !needsAccessTargetPick));
    els.stageEvents?.classList.toggle('hidden', !model.visibility?.events);
    els.stageRetention?.classList.toggle('hidden', !model.visibility?.retention);
    els.guideBack?.classList.toggle('hidden', model.questionNumber <= 1 && !model.allAnswered);

    if (els.codeSessionStatus) {
      if (!model.allAnswered) {
        els.codeSessionStatus.textContent = 'Answer the three questions to resolve CairnStone values.';
      } else if (isLightweightResolveAction(answers.actionId)) {
        const verb = answers.actionId === 'forward' ? 'Forward' : 'Give access';
        els.codeSessionStatus.textContent = needsAccessTargetPick
          ? `${verb} — choose Access to what? below. Console will not invent a Code Session.`
          : (autoResolve.code_session?.status === 'resolved'
            ? (autoResolve.code_session.detail || 'Code Session selected as access target')
            : (autoResolve.code_session?.status === 'skipped'
              ? `${verb} — Code Session not required for this intent.`
              : (autoResolve.code_session?.detail || `${verb} ready for review.`)));
      } else if (needsRepoBranchPick) {
        els.codeSessionStatus.textContent = 'No Chat-bound Code Session — pick one repo and branch below. Pins resolve server-side.';
      } else if (autoResolve.code_session?.status === 'resolved') {
        els.codeSessionStatus.textContent = autoResolve.code_session.detail || 'Code Session bound via Chat';
      } else {
        els.codeSessionStatus.textContent = 'Resolving Code Session…';
      }
    }
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
    const hasMcpTimeout = steps.some((step) => {
      const row = model.autoResolve?.[step.id] || {};
      return row.status === 'blocked' && (row.value?.code === 'MCP_TIMEOUT' || /timed out|timeout/i.test(String(row.detail || '')));
    }) || lastMcpTimeout;
    els.resolveList.innerHTML = steps.map((step) => {
      const row = model.autoResolve?.[step.id] || {};
      const status = row.status || 'pending';
      const detail = redactRawSha(row.detail || step.missing);
      const showRetry = status === 'blocked' && (row.value?.code === 'MCP_TIMEOUT' || /timed out|timeout/i.test(String(detail)));
      const retry = showRetry
        ? ` <button type="button" class="secondary compact-button work-resolve-retry" data-resolve-retry="1">Retry</button>`
        : '';
      return `<li class="work-resolve-item status-${esc(statusClass(status))}" data-resolve="${esc(step.id)}">
        <div class="work-resolve-head"><strong>${esc(step.label)}</strong><span class="work-resolve-status">${esc(status)}</span></div>
        <div class="muted small">${esc(detail)}${retry}</div>
      </li>`;
    }).join('');
    if (els.resolveRefresh) {
      els.resolveRefresh.textContent = hasMcpTimeout ? 'Retry' : 'Refresh resolve';
      els.resolveRefresh.dataset.mcpTimeout = hasMcpTimeout ? '1' : '0';
    }
  }

  function renderGuide() {
    const model = questionnaireModel(gatherInput());
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
    renderAccessConfirm();
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
    answers = { ...answers, whoMailboxId: mailboxId, whoDisplay: display, whoKey: key, who: display };
    persistAnswers();
    renderGuide();
  }

  function selectAction(actionId, label) {
    answers = { ...answers, actionId, actionLabel: label, what_should_they_do: label };
    persistAnswers();
    renderGuide();
  }

  function answerCurrentAndAdvance() {
    const model = questionnaireModel(gatherInput());
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
    if (model.allAnswered) void runAutoResolve();
  }

  function goBack() {
    if (questionIndex > 0) {
      questionIndex = Math.max(0, questionIndex - 1);
      renderGuide();
    }
  }


  
  function renderAccessConfirm() {
    if (!els.accessConfirm) return;
    const show = answers.actionId === 'give_access'
      && Boolean(answers.accessTargetId)
      && !needsAccessTargetPick;
    els.accessConfirm.classList.toggle('hidden', !show);
    if (!show) {
      // Clear Path A gate so assign/forward/custom are not left stuck disabled.
      if (els.intentHumanCommit) els.intentHumanCommit.disabled = false;
      if (els.intentCommitProposal) els.intentCommitProposal.disabled = false;
      return;
    }
    const target = accessTargetChoices.find((c) => c.id === answers.accessTargetId);
    const targetLabel = target?.label
      || answers.accessTargetLabel
      || (answers.accessTargetKind === 'workspace' ? 'this workspace' : 'this target');
    const prompt = accessGrantConfirmPrompt({
      actionId: answers.actionId,
      principalLabel: answers.whoDisplay || answers.whoMailboxId || 'this principal',
      targetLabel,
      permission: 'read'
    });
    if (els.accessConfirmText) els.accessConfirmText.textContent = prompt;
    if (els.accessConfirmCheck) {
      els.accessConfirmCheck.checked = Boolean(accessConfirmAccepted);
    }
    // Gate Human Commit until Path A confirm is checked.
    if (els.intentHumanCommit) {
      els.intentHumanCommit.disabled = !accessConfirmAccepted;
      if (!accessConfirmAccepted) els.intentHumanCommit.checked = false;
    }
    if (els.intentCommitProposal) {
      // app.js also gates on checkbox; keep disabled until confirm when visible
      els.intentCommitProposal.disabled = !accessConfirmAccepted;
    }
  }

  function renderAccessTargetChoices() {
    if (!els.accessTargetChoices) return;
    const selected = String(answers.accessTargetId || '').trim();
    if (!accessTargetChoices.length) {
      els.accessTargetChoices.innerHTML = '';
      if (els.accessTargetNote) {
        els.accessTargetNote.textContent = 'No Conversation binding found — pick Something else, or bind a workspace under Advanced. Console will not create a Code Session for Give access.';
      }
      return;
    }
    els.accessTargetChoices.innerHTML = accessTargetChoices.map((choice) => {
      const active = choice.id === selected ? ' active' : '';
      return `<button type="button" class="work-access-target-chip${active}" role="option" aria-selected="${choice.id === selected}" data-target-id="${esc(choice.id)}" data-target-kind="${esc(choice.kind)}" data-target-value="${esc(choice.value || '')}">${esc(choice.label)}</button>`;
    }).join('');
    if (els.accessTargetNote) {
      els.accessTargetNote.textContent = needsAccessTargetPick
        ? 'Access to what? One human choice — grants stay explicit second-tap.'
        : 'Access target captured.';
    }
  }

  function selectAccessTarget(targetId, kind, value) {
    answers = {
      ...answers,
      accessTargetId: targetId,
      accessTargetKind: kind,
      accessTargetValue: value || null
    };
    needsAccessTargetPick = false;
    accessConfirmAccepted = false;
    answers = { ...answers, accessConfirmAccepted: false, accessTargetLabel: accessTargetChoices.find((c) => c.id === targetId)?.label || '' };
    if (kind === 'other') {
      toast('Use Advanced / Share for another object — no auto Code Session create');
    }
    persistAnswers();
    renderGuide();
    void runAutoResolve({ scrollToCode: false });
  }

  async function discoverBoundSessions() {
    const actor = typeof actorId === 'function' ? actorId() : '';
    if (!actor) throw new Error('Actor ID required for Conversation Session discovery');
    const data = await mcpCall('cairnstone_conversation_session_list', {
      actor_id: actor,
      limit: 50
    });
    // CS-filtered rows for Code Session bind; refs keep workspace/conversation even without CS.
    discoveredSessions = codeSessionsFromConversationList(data);
    conversationRefs = conversationRefsFromList(data);
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

  async function resolvePinsServerSide(repoFull, branch) {
    const parsed = parseRepoPick(repoFull);
    if (!parsed) throw new Error('Repository must look like owner/repo');
    const ref = String(branch || 'main').trim() || 'main';
    const data = await mcpCall('cairnstone_reconcile_repo', {
      chain: parsed.full,
      owner: parsed.owner,
      repo: parsed.repo,
      ref
    });
    const sha = extractResolvedCommitSha(data);
    if (!sha) {
      throw new Error('Server did not return a resolved pin for that repo + branch');
    }
    return {
      sourceRepos: [parsed.full],
      baseCommits: [{ repo: parsed.full, commit_sha: sha }],
      workingTransport: { branch: ref, observed_commit_sha: sha }
    };
  }

  function applyBoundSession(codeSessionId, { fromDiscovery = false } = {}) {
    if (!codeSessionId) return;
    if (els.codeSessionId) els.codeSessionId.value = codeSessionId;
    try { sessionStorage.setItem('cs.codeSessionId', codeSessionId); } catch { /* ignore */ }
    writeWorkGuidePrefs({ codeSessionFromDiscovery: Boolean(fromDiscovery) });
    // Guard so the change listener does not clobber codeSessionFromDiscovery.
    applyingBoundSession = true;
    try {
      els.codeSessionId?.dispatchEvent(new Event('change'));
    } finally {
      applyingBoundSession = false;
    }
  }

  async function runAutoResolve({ scrollToCode = true } = {}) {
    if (resolving) return;
    resolving = true;
    const actionId = String(answers.actionId || '').trim();
    const isGiveAccess = actionId === 'give_access';
    const isLightweight = isLightweightResolveAction(actionId);

    // Show resolving rows before any await (skipped rows terminal for lightweight intents).
    autoResolve = resolvingAutoResolvePlaceholder(actionId);
    lastMcpTimeout = false;
    persistAnswers();
    renderGuide();
    toast(isLightweight ? 'Resolving access targets…' : 'Resolving CairnStone values…');

    let mcpTimeout = false;
    let mcpTimeoutDetail = '';
    try {
      const prefs = readWorkGuidePrefs();
      let workspaceId = (els.workspaceId?.value || prefs.workspaceId || '').trim();
      const hasWorkspaceCapability = Boolean((els.workspaceCap?.value || '').trim());
      workspaceHumanMeta.fromPrefs = Boolean(prefs.workspaceId);
      let sessions = [];
      try {
        sessions = await discoverBoundSessions();
        renderDiscoveryOptions(sessions);
      } catch (err) {
        renderDiscoveryOptions([], { error: err });
        if (err?.code === 'MCP_TIMEOUT' || err?.blocked) {
          mcpTimeout = true;
          lastMcpTimeout = true;
          mcpTimeoutDetail = err.message || 'Conversation list timed out';
          toast(`${mcpTimeoutDetail} — ${err.cta || 'Retry'}`);
        } else {
          toast(err.message || 'Conversation Session list unavailable');
        }
      }

      discoveredSessions = sessions;
      accessTargetChoices = accessTargetChoicesFromDiscovery({
        sessions,
        conversationRefs,
        workspaceId,
        conversationTitle: workspaceHumanMeta.conversationTitle,
        projectName: workspaceHumanMeta.projectName
      });
      needsAccessTargetPick = needsAccessTargetQuestion(
        actionId,
        accessTargetChoices,
        answers.accessTargetId || ''
      );
      renderAccessTargetChoices();

      const best = sessions[0] || null;
      if (best?.conversationTitle) workspaceHumanMeta.conversationTitle = best.conversationTitle;
      if (best?.projectName) workspaceHumanMeta.projectName = best.projectName;

      // Auto-pick sole concrete target for lightweight intents (Path A confirm follows for give_access).
      if (isLightweight && !needsAccessTargetPick && !answers.accessTargetId) {
        const sole = accessTargetChoices.find((c) => c.kind !== 'other' && c.value);
        if (sole) {
          answers = {
            ...answers,
            accessTargetId: sole.id,
            accessTargetKind: sole.kind,
            accessTargetValue: sole.value,
            accessTargetLabel: sole.label || '',
            accessConfirmAccepted: false
          };
          accessConfirmAccepted = false;
          if ((sole.kind === 'workspace' || sole.kind === 'conversation') && (sole.workspaceId || sole.value) && !workspaceId) {
            workspaceId = String(sole.workspaceId || sole.value);
          }
        }
      }

      if (isLightweight && answers.accessTargetKind === 'workspace' && answers.accessTargetValue) {
        workspaceId = String(answers.accessTargetValue);
      }
      if (isLightweight && answers.accessTargetKind === 'conversation') {
        const ref = conversationRefs.find((r) => r.conversationId === answers.accessTargetValue);
        if (ref?.workspaceId) workspaceId = String(ref.workspaceId);
      }

      if (best?.workspaceId && !workspaceId && !isLightweight) {
        workspaceId = best.workspaceId;
      }
      // Prefer workspace from conversation refs even without a Code Session.
      if (!workspaceId && conversationRefs[0]?.workspaceId && isLightweight) {
        workspaceId = conversationRefs[0].workspaceId;
        if (conversationRefs[0].conversationTitle) {
          workspaceHumanMeta.conversationTitle = conversationRefs[0].conversationTitle;
        }
      }
      if (workspaceId) {
        if (els.workspaceId) els.workspaceId.value = workspaceId;
        writeWorkGuidePrefs({ workspaceId });
        syncInviteWorkspace(workspaceId);
      }

      if (isLightweight) {
        // Never spin on repo/branch bind and never create a Code Session by default.
        needsRepoBranchPick = false;
        if (answers.accessTargetKind === 'code_session' && answers.accessTargetValue) {
          applyBoundSession(answers.accessTargetValue, { fromDiscovery: true });
        }
      } else if (best?.codeSessionId) {
        applyBoundSession(best.codeSessionId, { fromDiscovery: true });
        needsRepoBranchPick = false;
      } else {
        needsRepoBranchPick = true;
      }

      const workspaceCapability = (els.workspaceCap?.value || '').trim();
      let sourceRepos = best?.sourceRepos || [];
      let baseCommits = best?.baseCommits || [];
      if (!isLightweight && best?.codeSessionId && workspaceCapability) {
        try {
          const hydrated = await hydratePinsFromCodeSession(best.codeSessionId, workspaceCapability);
          if (hydrated.sourceRepos.length) sourceRepos = hydrated.sourceRepos;
          if (hydrated.baseCommits.length) baseCommits = hydrated.baseCommits;
        } catch (err) {
          if (err?.code === 'MCP_TIMEOUT' || err?.blocked) {
            mcpTimeout = true;
            lastMcpTimeout = true;
            mcpTimeoutDetail = err.message || 'Code Session pin hydrate timed out';
          }
        }
      }

      const taskRunId = (els.dispatchTaskRunId?.value || '').trim();
      const codeSessionForSnap = isLightweight
        ? (answers.accessTargetKind === 'code_session'
          ? {
            codeSessionId: answers.accessTargetValue,
            conversationId: best?.conversationId || conversationRefs.find((r) => r.codeSessionId === answers.accessTargetValue)?.conversationId || null,
            conversationTitle: best?.conversationTitle || answers.accessTargetLabel || null
          }
          : null)
        : best;

      autoResolve = buildAutoResolveSnapshot({
        workspaceId,
        conversationTitle: workspaceHumanMeta.conversationTitle,
        projectName: workspaceHumanMeta.projectName,
        fromPrefs: workspaceHumanMeta.fromPrefs || Boolean(workspaceId),
        hasWorkspaceCapability,
        codeSession: codeSessionForSnap,
        sourceRepos: isLightweight ? [] : sourceRepos,
        baseCommits: isLightweight ? [] : baseCommits,
        taskRunId: isLightweight ? '' : taskRunId,
        proposalReady: isLightweight ? false : proposalReady,
        eventsReady: isLightweight ? false : (proposalReady || Boolean(taskRunId)),
        needsRepoBranchPick: isLightweight ? false : needsRepoBranchPick,
        idBundle: {
          workspace_id: workspaceId,
          code_session_id: codeSessionForSnap?.codeSessionId || null,
          conversation_id: best?.conversationId || conversationRefs[0]?.conversationId || null,
          task_run_id: isLightweight ? null : (taskRunId || null)
        },
        actionId,
        needsAccessTargetPick,
        accessTargetId: answers.accessTargetId || '',
        accessTargetKind: answers.accessTargetKind || '',
        accessTargetLabel: answers.accessTargetLabel || '',
        mcpTimeout,
        mcpTimeoutDetail
      });
      persistAnswers();

      if (els.intentText) {
        els.intentText.value = composeIntentFromAnswers(answers);
        els.intentText.dataset.fromQuestionnaire = '1';
        els.intentText.dispatchEvent(new Event('input'));
      }

      if (!isLightweight && best?.codeSessionId && hasWorkspaceCapability && !consoleViewKickoffDone) {
        consoleViewKickoffDone = true;
        els.codeLoad?.click();
      }

      if (!isLightweight && scrollToCode && best?.codeSessionId) softScrollToCodeSession();

      if (mcpTimeout) {
        lastMcpTimeout = true;
        toast(`${mcpTimeoutDetail || 'Resolve timed out'} — tap Retry`);
      } else if (isLightweight && needsAccessTargetPick) {
        toast('Access to what? Pick one target — Console will not invent a Code Session');
      } else if (isGiveAccess) {
        toast('Confirm access target below — Human Commit still required (no auto-grant)');
      } else if (actionId === 'forward') {
        toast('Forward resolved — review before Human Commit (no auto-dispatch)');
      } else {
        toast(best?.codeSessionId
          ? 'Resolved from Conversation bindings — review before Human Commit'
          : 'Pick one repo + branch to bind a Code Session (pins resolve server-side)');
      }
    } finally {
      resolving = false;
      renderGuide();
    }
  }


  async function bindFromRepoBranch() {
    const repo = (els.repoPick?.value || '').trim();
    const branch = (els.branchPick?.value || 'main').trim() || 'main';
    const workspaceId = (els.workspaceId?.value || readWorkGuidePrefs().workspaceId || '').trim();
    const workspaceCapability = (els.workspaceCap?.value || '').trim();
    const actor = typeof actorId === 'function' ? actorId() : '';

    if (!repo) return toast('Enter a repository as owner/repo');
    if (!workspaceId) return toast('Workspace must be resolved first (Chat binding or Advanced)');
    if (!workspaceCapability) return toast('Workspace capability required (session only)');
    if (!actor) return toast('Actor ID required');

    const parsed = parseRepoPick(repo);
    if (!parsed) return toast('Repository must look like owner/repo');

    busy(els.repoBranchBindBtn, true, 'Resolving…');
    if (els.repoBranchNote) {
      els.repoBranchNote.textContent = `Resolving pins for ${parsed.full}@${branch} server-side…`;
    }
    try {
      const pins = await resolvePinsServerSide(parsed.full, branch);
      // Mint session id internally — never shown as a default-mode field.
      const codeSessionId = mintCodeSessionId();
      const data = await mcpCall('cairnstone_code_session_create', {
        code_session_id: codeSessionId,
        workspace_id: workspaceId,
        created_by: actor,
        workspace_capability: workspaceCapability,
        source_repos: pins.sourceRepos,
        base_commits: pins.baseCommits,
        working_transport: pins.workingTransport
      });
      if (data?.ok === false) throw new Error(data.error || 'create_failed');
      const createdId = data.code_session_id
        || data.persistent_code_session?.code_session_id
        || codeSessionId;
      applyBoundSession(createdId, { fromDiscovery: false });
      needsRepoBranchPick = false;
      if (els.repoBranchNote) {
        els.repoBranchNote.textContent = `Bound ${parsed.full} @ ${branch} (pins resolved server-side; hash hidden).`;
      }
      toast('Code Session bound from repo + branch');
      await runAutoResolve({ scrollToCode: true });
      if (!consoleViewKickoffDone && workspaceCapability) {
        consoleViewKickoffDone = true;
        els.codeLoad?.click();
      }
      softScrollToCodeSession();
    } catch (err) {
      if (els.repoBranchNote) {
        els.repoBranchNote.textContent = err.message || 'Bind failed — fail closed';
      }
      toast(err.message || 'Bind Code Session failed — fail closed');
    } finally {
      busy(els.repoBranchBindBtn, false, 'Bind Code Session');
    }
  }

  function saveWorkspace() {
    const workspaceId = (els.workspaceId?.value || '').trim();
    const cap = (els.workspaceCap?.value || '').trim();
    if (!workspaceId) return toast('Workspace ID is required');
    if (!cap) return toast('Workspace capability is required (session only; never stoned)');
    writeWorkGuidePrefs({ workspaceId });
    workspaceHumanMeta.fromPrefs = true;
    try { sessionStorage.setItem('cs.workspaceCapability', cap); } catch { /* ignore */ }
    syncInviteWorkspace(workspaceId);
    toast('Workspace saved for this browser session');
    if (questionnaireModel(gatherInput()).allAnswered) void runAutoResolve();
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
        els.discoveryNote.textContent = 'No Conversation Session currently binds a code_session_id. Prefer default repo + branch bind; Advanced Create is the SHA escape hatch.';
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
    applyBoundSession(id, { fromDiscovery: true });
    needsRepoBranchPick = false;
    toast('Code Session selected via Conversation binding');
    if (questionnaireModel(gatherInput()).allAnswered) void runAutoResolve({ scrollToCode: true });
    else renderGuide();
  }

  async function createCodeSessionAdvanced() {
    const workspaceId = (els.workspaceId?.value || readWorkGuidePrefs().workspaceId || '').trim();
    const workspaceCapability = (els.workspaceCap?.value || '').trim();
    const actor = typeof actorId === 'function' ? actorId() : '';
    const codeSessionId = (els.createId?.value || '').trim();
    const sourceRepos = parseRepos(els.createRepos?.value);
    const baseCommits = parseCommits(els.createCommits?.value);

    if (!workspaceId) return toast('Workspace ID required');
    if (!workspaceCapability) return toast('Workspace capability required (session only)');
    if (!actor) return toast('Actor ID required');
    if (!codeSessionId) return toast('New Code Session ID required (Advanced)');
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
      applyBoundSession(createdId, { fromDiscovery: false });
      needsRepoBranchPick = false;
      toast('Code Session created (Advanced)');
      await refreshDiscovery();
      if (questionnaireModel(gatherInput()).allAnswered) await runAutoResolve({ scrollToCode: true });
      else renderGuide();
    } catch (err) {
      toast(err.message || 'Create Code Session failed — fail closed');
    } finally {
      busy(els.createBtn, false, 'Create Code Session');
    }
  }

  function runPrimaryCta() {
    const action = els.guidePrimaryCta?.dataset.action
      || questionnaireModel(gatherInput()).primaryCta.action;
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
        softScrollToCodeSession();
        return;
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
    if (loaded) softScrollToCodeSession();
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
          conversationTitle: workspaceHumanMeta.conversationTitle,
          projectName: workspaceHumanMeta.projectName,
          fromPrefs: workspaceHumanMeta.fromPrefs,
          hasWorkspaceCapability: Boolean((els.workspaceCap?.value || '').trim()),
          codeSession: discoveredSessions[0] || {
            codeSessionId: (els.codeSessionId?.value || '').trim() || null
          },
          sourceRepos: discoveredSessions[0]?.sourceRepos || [],
          baseCommits: discoveredSessions[0]?.baseCommits || [],
          taskRunId,
          proposalReady: true,
          eventsReady: true,
          needsRepoBranchPick: false
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
          detail: 'Task Run ready — Human Commit / Dispatch still second-tap',
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
    workspaceHumanMeta.fromPrefs = true;
    renderGuide();
  });
  els.workspaceCap?.addEventListener('input', () => {
    if (questionnaireModel(gatherInput()).allAnswered) void runAutoResolve({ scrollToCode: false });
    else renderGuide();
  });
  els.addCollaborator?.addEventListener('click', addCollaborator);
  els.collaboratorContinue?.addEventListener('click', continueAfterCollaborator);
  els.codeRefresh?.addEventListener('click', () => void refreshDiscovery());
  els.codeUse?.addEventListener('click', useSelectedCodeSession);
  els.createBtn?.addEventListener('click', () => void createCodeSessionAdvanced());
  els.repoBranchBindBtn?.addEventListener('click', () => void bindFromRepoBranch());
  els.guidePrimaryCta?.addEventListener('click', runPrimaryCta);
  els.guideBack?.addEventListener('click', goBack);
  els.resolveRefresh?.addEventListener('click', () => void runAutoResolve({ scrollToCode: false }));
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
  
  els.accessTargetChoices?.addEventListener('click', (ev) => {
    const btn = ev.target?.closest?.('[data-target-id]');
    if (!btn) return;
    selectAccessTarget(btn.dataset.targetId, btn.dataset.targetKind, btn.dataset.targetValue);
  });
  els.actionChoices?.addEventListener('click', (ev) => {
    const btn = ev.target?.closest?.('[data-action-id]');
    if (!btn) return;
    selectAction(btn.dataset.actionId, btn.dataset.label);
  });
  els.accessConfirmCheck?.addEventListener('change', () => {
    accessConfirmAccepted = Boolean(els.accessConfirmCheck.checked);
    answers = { ...answers, accessConfirmAccepted };
    persistAnswers();
    renderAccessConfirm();
    renderGuide();
  });
  els.resolveList?.addEventListener('click', (ev) => {
    const btn = ev.target?.closest?.('[data-resolve-retry]');
    if (!btn) return;
    void runAutoResolve({ scrollToCode: false });
  });
  els.intentText?.addEventListener('input', () => {
    if (els.intentText.dataset.fromQuestionnaire === '1') {
      delete els.intentText.dataset.fromQuestionnaire;
    }
    renderGuide();
  });
  els.dispatchTaskRunId?.addEventListener('input', () => renderGuide());
  els.codeSessionId?.addEventListener('change', () => {
    if (!applyingBoundSession) {
      writeWorkGuidePrefs({ codeSessionFromDiscovery: false });
    }
    renderGuide();
  });
  els.advancedShell?.addEventListener('toggle', () => renderGuide());

  window.addEventListener('cairn:work-code-session-loaded', (ev) => {
    markCodeSessionLoaded(ev?.detail?.ok !== false);
  });
  window.addEventListener('cairn:work-proposal-ready', () => markProposalReady(true));
  window.addEventListener('cairn:work-proposal-committed', () => markProposalCommitted(true));
  window.addEventListener('cairn:work-dispatched', () => markDispatched(true));

  renderGuide();
  if (questionnaireModel(gatherInput()).allAnswered) void runAutoResolve({ scrollToCode: false });

  return {
    refresh: renderGuide,
    refreshDiscovery,
    runAutoResolve,
    markCodeSessionLoaded,
    markProposalCommitted,
    markProposalReady,
    markDispatched,
    gatherState: gatherInput
  };
}
