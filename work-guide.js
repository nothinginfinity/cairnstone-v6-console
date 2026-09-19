/**
 * V7.7.x — Guided operator Work flow (presentation only).
 * Orders: Choose workspace → Add collaborator → Select/Create Code Session
 * → Describe work → Review / Human Commit → Dispatch / Watch.
 * Never weakens scoped_grant or accepted-state authority.
 */

export const WORK_GUIDE_STEPS = Object.freeze([
  {
    id: 'choose_workspace',
    number: 1,
    title: 'Choose workspace',
    missing: 'Select a workspace and keep its capability in this browser session only.',
    cta: 'Save workspace',
    ctaAction: 'save_workspace'
  },
  {
    id: 'add_collaborator',
    number: 2,
    title: 'Add collaborator',
    missing: 'Invite a collaborator to the workspace (Invite plane). Distinct from Share reference (access grant).',
    cta: 'Add collaborator',
    ctaAction: 'add_collaborator'
  },
  {
    id: 'code_session',
    number: 3,
    title: 'Select or create Code Session',
    missing: 'Bind a Code Session from Conversation Session links, or create one. Raw IDs stay under Advanced.',
    cta: 'Select or create Code Session',
    ctaAction: 'focus_code_session'
  },
  {
    id: 'describe_work',
    number: 4,
    title: 'Describe work',
    missing: 'Write the work intent in plain language once a Code Session is ready.',
    cta: 'Describe work',
    ctaAction: 'focus_describe'
  },
  {
    id: 'review_commit',
    number: 5,
    title: 'Review + Human Commit',
    missing: 'Route intent and Human-Commit the proposal (no auto-dispatch).',
    cta: 'Review proposal',
    ctaAction: 'focus_review'
  },
  {
    id: 'dispatch_watch',
    number: 6,
    title: 'Dispatch + Watch',
    missing: 'Human-Commit dispatch, then watch Events / Agent Tree. Retention stays diagnostic.',
    cta: 'Dispatch + Watch',
    ctaAction: 'focus_dispatch'
  }
]);

/**
 * @param {object} input
 * @param {string} [input.workspaceId]
 * @param {boolean} [input.hasWorkspaceCapability]
 * @param {boolean} [input.collaboratorStepDone]
 * @param {string} [input.codeSessionId]
 * @param {boolean} [input.codeSessionLoaded]
 * @param {boolean} [input.codeSessionFromDiscovery] honest select/create (not raw-only)
 * @param {string} [input.workDescription]
 * @param {boolean} [input.proposalCommitted]
 * @param {string} [input.taskRunId]
 * @param {boolean} [input.dispatched]
 */
export function workGuideModel(input = {}) {
  const workspaceId = String(input.workspaceId || '').trim();
  const hasWorkspaceCapability = Boolean(input.hasWorkspaceCapability);
  const collaboratorStepDone = Boolean(input.collaboratorStepDone);
  const codeSessionId = String(input.codeSessionId || '').trim();
  const codeSessionLoaded = Boolean(input.codeSessionLoaded);
  const codeSessionFromDiscovery = Boolean(input.codeSessionFromDiscovery);
  const workDescription = String(input.workDescription || '').trim();
  const proposalCommitted = Boolean(input.proposalCommitted);
  const taskRunId = String(input.taskRunId || '').trim();
  const dispatched = Boolean(input.dispatched);

  const workspaceReady = Boolean(workspaceId && hasWorkspaceCapability);
  const codeSessionReady = Boolean(codeSessionId && (codeSessionLoaded || codeSessionFromDiscovery));
  const describeReady = Boolean(codeSessionReady && workDescription);
  const reviewReady = Boolean(describeReady && proposalCommitted);
  const dispatchReady = Boolean(reviewReady && (dispatched || taskRunId));

  const readiness = {
    choose_workspace: workspaceReady,
    add_collaborator: workspaceReady && collaboratorStepDone,
    code_session: codeSessionReady,
    describe_work: describeReady,
    review_commit: reviewReady,
    dispatch_watch: dispatchReady
  };

  let current = WORK_GUIDE_STEPS[0];
  for (const step of WORK_GUIDE_STEPS) {
    current = step;
    if (!readiness[step.id]) break;
  }
  if (WORK_GUIDE_STEPS.every(s => readiness[s.id])) {
    current = WORK_GUIDE_STEPS[WORK_GUIDE_STEPS.length - 1];
  }

  const ready = [];
  const missing = [];
  for (const step of WORK_GUIDE_STEPS) {
    if (readiness[step.id]) ready.push(step.title);
    else missing.push(step.missing);
  }

  const allDone = WORK_GUIDE_STEPS.every(s => readiness[s.id]);

  return {
    steps: WORK_GUIDE_STEPS,
    currentStepId: current.id,
    stepNumber: current.number,
    stepCount: WORK_GUIDE_STEPS.length,
    title: allDone ? 'Work flow ready' : `Step ${current.number} of ${WORK_GUIDE_STEPS.length}`,
    subtitle: allDone
      ? 'Workspace, Code Session, proposal, and dispatch path are in place. Events / Retention are diagnostics.'
      : current.title,
    ready,
    missing: allDone ? [] : [current.missing],
    primaryCta: allDone
      ? { label: 'Watch events', action: 'focus_dispatch' }
      : { label: current.cta, action: current.ctaAction },
    visibility: {
      workspace: true,
      collaborator: workspaceReady,
      codeSession: workspaceReady && collaboratorStepDone,
      describe: codeSessionReady,
      review: codeSessionReady,
      dispatch: codeSessionReady && (proposalCommitted || Boolean(taskRunId) || dispatched),
      events: codeSessionReady,
      retention: codeSessionReady,
      runtimeSurface: codeSessionLoaded,
      advancedIds: true
    },
    flags: {
      workspaceReady,
      collaboratorStepDone,
      codeSessionReady,
      codeSessionLoaded,
      describeReady,
      reviewReady,
      dispatchReady,
      allDone,
      acceptedStateAuthority: false,
      scopedGrantUnchanged: true
    }
  };
}

/** sessionStorage keys for guide presentation prefs (never capabilities). */
export const WORK_GUIDE_STORE = Object.freeze({
  workspaceId: 'cs.workspaceId',
  collaboratorDone: 'cs.workGuide.collaboratorDone',
  discoveryBound: 'cs.workGuide.codeSessionFromDiscovery'
});

export function readWorkGuidePrefs(storage = sessionStorage) {
  try {
    return {
      workspaceId: String(storage.getItem(WORK_GUIDE_STORE.workspaceId) || '').trim(),
      collaboratorStepDone: storage.getItem(WORK_GUIDE_STORE.collaboratorDone) === '1',
      codeSessionFromDiscovery: storage.getItem(WORK_GUIDE_STORE.discoveryBound) === '1'
    };
  } catch {
    return { workspaceId: '', collaboratorStepDone: false, codeSessionFromDiscovery: false };
  }
}

export function writeWorkGuidePrefs(partial = {}, storage = sessionStorage) {
  try {
    if ('workspaceId' in partial) {
      const v = String(partial.workspaceId || '').trim();
      if (v) storage.setItem(WORK_GUIDE_STORE.workspaceId, v);
      else storage.removeItem(WORK_GUIDE_STORE.workspaceId);
    }
    if ('collaboratorStepDone' in partial) {
      if (partial.collaboratorStepDone) storage.setItem(WORK_GUIDE_STORE.collaboratorDone, '1');
      else storage.removeItem(WORK_GUIDE_STORE.collaboratorDone);
    }
    if ('codeSessionFromDiscovery' in partial) {
      if (partial.codeSessionFromDiscovery) storage.setItem(WORK_GUIDE_STORE.discoveryBound, '1');
      else storage.removeItem(WORK_GUIDE_STORE.discoveryBound);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Honest Code Session options from Conversation Session list rows.
 * Only rows with a non-empty code_session_id are selectable — never invent IDs.
 */
export function codeSessionsFromConversationList(payload) {
  const rows = payload?.sessions
    || payload?.conversation_sessions
    || payload?.items
    || (Array.isArray(payload) ? payload : []);
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const codeSessionId = String(
      row?.code_session_id
      || row?.bindings?.code_session_id
      || row?.codeSessionId
      || ''
    ).trim();
    if (!codeSessionId || seen.has(codeSessionId)) continue;
    seen.add(codeSessionId);
    const conversationId = String(row?.conversation_id || row?.id || '').trim();
    const workspaceId = String(row?.workspace_id || row?.bindings?.workspace_id || '').trim();
    out.push({
      codeSessionId,
      conversationId: conversationId || null,
      workspaceId: workspaceId || null,
      label: conversationId
        ? `${codeSessionId} · via ${conversationId}`
        : codeSessionId,
      source: 'conversation_session'
    });
  }
  return out;
}
