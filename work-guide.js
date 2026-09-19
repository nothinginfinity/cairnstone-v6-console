/**
 * V7.7.x — Console Zero-ID questionnaire Work UX (presentation only).
 *
 * Product rule: humans answer human questions; CairnStone resolves CairnStone values.
 * Default Work = 3 questions one-at-a-time (what / who / what should they do),
 * then auto-resolve workspace, access readiness, Code Session, source_repos/base_commits,
 * IDs, Task Run + events. The prior 6 ID-ish steps live under Advanced.
 *
 * Never weakens scoped_grant or accepted-state authority.
 * Access grant / Human Commit / Dispatch remain explicit second-tap.
 * No raw SHA in default mode. 10h.4 runtime acceptance stays a separate gate.
 */

import { SEED_ACTORS, displayNameForNamespace, parseMailboxId } from './actor-inbox-nav.js';

/** Default Work — human questions only. */
export const WORK_QUESTIONS = Object.freeze([
  {
    id: 'what',
    number: 1,
    title: 'What?',
    prompt: 'What is the work?',
    hint: 'Describe the outcome in plain language. Do not paste session IDs or commit SHAs.',
    input: 'text',
    cta: 'Continue',
    ctaAction: 'answer_what'
  },
  {
    id: 'who',
    number: 2,
    title: 'Who?',
    prompt: 'Who should do it?',
    hint: 'Pick a person by name. Exact mailbox IDs stay under Advanced.',
    input: 'actor',
    cta: 'Continue',
    ctaAction: 'answer_who'
  },
  {
    id: 'what_should_they_do',
    number: 3,
    title: 'What should they do?',
    prompt: 'What should they do?',
    hint: 'Choose the human action. Access grant, Human Commit, and Dispatch still need a second tap.',
    input: 'action',
    cta: 'Resolve with CairnStone',
    ctaAction: 'answer_action'
  }
]);

/** CairnStone values resolved after the three human answers (never asked as ID fields). */
export const WORK_AUTO_RESOLVE_STEPS = Object.freeze([
  {
    id: 'workspace',
    label: 'Workspace',
    missing: 'No workspace bound yet — resolve from Conversation Session or session prefs.'
  },
  {
    id: 'access_readiness',
    label: 'Access readiness',
    missing: 'Workspace capability missing for this browser session (session-only; never stoned).'
  },
  {
    id: 'code_session',
    label: 'Code Session',
    missing: 'No Code Session discovered from Conversation bindings yet.'
  },
  {
    id: 'source_repos_base_commits',
    label: 'Repos & pins',
    missing: 'Source repos / base pins not yet read from the Code Session record.'
  },
  {
    id: 'ids',
    label: 'IDs',
    missing: 'Operational IDs not yet resolved.'
  },
  {
    id: 'task_run_events',
    label: 'Task Run + events',
    missing: 'Intent not yet routed into a proposal / events surface.'
  }
]);

/**
 * Advanced escape hatch — prior 6 ID-ish operator steps.
 * Kept distinct from the default questionnaire.
 */
export const WORK_ADVANCED_STEPS = Object.freeze([
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

/** @deprecated Use WORK_ADVANCED_STEPS — retained for callers/tests that still name the 6-step guide. */
export const WORK_GUIDE_STEPS = WORK_ADVANCED_STEPS;

/** Suggested actions for question 3 (human verbs, not MCP tool IDs). */
export const WORK_ACTION_CHOICES = Object.freeze([
  {
    id: 'assign',
    label: 'Assign / ask them to work',
    intentHint: 'assign'
  },
  {
    id: 'give_access',
    label: 'Give access',
    intentHint: 'give-access'
  },
  {
    id: 'forward',
    label: 'Forward with a note',
    intentHint: 'forward-with-note'
  },
  {
    id: 'custom',
    label: 'Something else (plain language)',
    intentHint: null
  }
]);

export const WORK_GUIDE_STORE = Object.freeze({
  workspaceId: 'cs.workspaceId',
  collaboratorDone: 'cs.workGuide.collaboratorDone',
  discoveryBound: 'cs.workGuide.codeSessionFromDiscovery',
  answers: 'cs.workGuide.questionnaireAnswers',
  autoResolve: 'cs.workGuide.autoResolve'
});

const SHA_RE = /\b[0-9a-f]{7,40}\b/gi;

/** Strip / mask raw SHAs for default-mode copy. */
export function redactRawSha(text) {
  return String(text || '').replace(SHA_RE, '·pin·');
}

export function humanActorOptions(extra = []) {
  const seen = new Set();
  const out = [];
  for (const seed of SEED_ACTORS) {
    const workId = seed.mailboxes?.work || seed.mailboxes?.chat || '';
    if (!workId || seen.has(seed.key)) continue;
    seen.add(seed.key);
    out.push({
      key: seed.key,
      display: seed.display,
      mailboxId: workId,
      source: 'seed'
    });
  }
  for (const row of extra) {
    const mailboxId = String(row?.mailboxId || row?.id || row?.raw || '').trim();
    if (!mailboxId) continue;
    const parsed = parseMailboxId(mailboxId);
    const key = String(row?.key || parsed?.namespace || mailboxId).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      display: row?.display || displayNameForNamespace(parsed?.namespace || key),
      mailboxId,
      source: row?.source || 'observed'
    });
  }
  return out;
}

export function composeIntentFromAnswers(answers = {}) {
  const what = String(answers.what || '').trim();
  const whoDisplay = String(answers.whoDisplay || answers.who || '').trim();
  const whoMailbox = String(answers.whoMailboxId || '').trim();
  const actionLabel = String(answers.actionLabel || answers.what_should_they_do || '').trim();
  const actionNote = String(answers.actionNote || '').trim();
  const lines = [];
  if (what) lines.push(`What: ${what}`);
  if (whoDisplay || whoMailbox) {
    lines.push(whoMailbox && whoDisplay
      ? `Who: ${whoDisplay}`
      : `Who: ${whoDisplay || whoMailbox}`);
  }
  if (actionLabel) lines.push(`What they should do: ${actionLabel}`);
  if (actionNote) lines.push(actionNote);
  return lines.join('\n');
}

/**
 * @param {object} input
 * @param {object} [input.answers]
 * @param {number} [input.questionIndex] 0-based; omit to derive from answers
 * @param {object} [input.autoResolve] per-step { status, label, detail }
 * @param {boolean} [input.proposalReady]
 * @param {boolean} [input.proposalCommitted]
 * @param {boolean} [input.dispatched]
 * @param {boolean} [input.advancedOpen]
 */
export function questionnaireModel(input = {}) {
  const answers = input.answers && typeof input.answers === 'object' ? input.answers : {};
  const answered = {
    what: Boolean(String(answers.what || '').trim()),
    who: Boolean(String(answers.whoMailboxId || answers.who || '').trim()),
    what_should_they_do: Boolean(
      String(answers.actionId || answers.actionLabel || answers.what_should_they_do || '').trim()
    )
  };
  let questionIndex = Number.isInteger(input.questionIndex)
    ? input.questionIndex
    : WORK_QUESTIONS.findIndex((q) => !answered[q.id]);
  if (questionIndex < 0) questionIndex = WORK_QUESTIONS.length; // all answered
  if (questionIndex > WORK_QUESTIONS.length) questionIndex = WORK_QUESTIONS.length;

  const allAnswered = WORK_QUESTIONS.every((q) => answered[q.id]);
  const current = allAnswered ? null : WORK_QUESTIONS[Math.min(questionIndex, WORK_QUESTIONS.length - 1)];

  const autoResolve = normalizeAutoResolve(input.autoResolve);
  const actionId = String(answers.actionId || input.actionId || '').trim();
  const { resolveComplete, resolveBlocked } = computeResolveCompletion(autoResolve, actionId);
  const proposalReady = Boolean(input.proposalReady);
  const proposalCommitted = Boolean(input.proposalCommitted);
  const dispatched = Boolean(input.dispatched);

  let phase = 'questions';
  if (allAnswered && !resolveComplete && !resolveBlocked) phase = 'resolving';
  if (allAnswered && (resolveComplete || resolveBlocked || proposalReady)) phase = 'confirm';
  if (proposalCommitted && !dispatched) phase = 'await_dispatch';
  if (dispatched) phase = 'watch';

  const primaryCta = (() => {
    if (!allAnswered && current) {
      return { label: current.cta, action: current.ctaAction };
    }
    if (phase === 'resolving') {
      return { label: 'Resolving…', action: 'noop_resolving' };
    }
    if (phase === 'confirm' && !proposalCommitted) {
      return { label: 'Review · Human Commit', action: 'focus_review' };
    }
    if (phase === 'await_dispatch') {
      return { label: 'Dispatch · second tap', action: 'focus_dispatch' };
    }
    if (phase === 'watch') {
      return { label: 'Watch events', action: 'focus_dispatch' };
    }
    return { label: 'Resolve with CairnStone', action: 'run_auto_resolve' };
  })();

  return {
    mode: 'zero_id_questionnaire',
    questions: WORK_QUESTIONS,
    currentQuestionId: current?.id || null,
    questionIndex: allAnswered ? WORK_QUESTIONS.length : (current?.number || 1) - 1,
    questionNumber: current?.number || WORK_QUESTIONS.length,
    questionCount: WORK_QUESTIONS.length,
    title: allAnswered
      ? (phase === 'watch' ? 'Work ready' : 'CairnStone resolving')
      : `Question ${current.number} of ${WORK_QUESTIONS.length}`,
    subtitle: allAnswered
      ? (phase === 'confirm'
        ? 'Human answers captured. Review the proposal — Human Commit and Dispatch stay explicit second taps.'
        : phase === 'resolving'
          ? 'Resolving workspace, access readiness, Code Session, pins, IDs, and Task Run surface…'
          : 'Watch Events / Agent Tree. Retention and 10h.4 runtime acceptance stay separate.')
      : current.prompt,
    hint: current?.hint || '',
    answers,
    answered,
    allAnswered,
    phase,
    autoResolve,
    autoResolveSteps: WORK_AUTO_RESOLVE_STEPS,
    resolveComplete,
    resolveBlocked,
    primaryCta,
    actionChoices: WORK_ACTION_CHOICES,
    actorOptions: humanActorOptions(input.extraActors),
    visibility: {
      questionnaire: true,
      autoResolve: allAnswered,
      confirm: allAnswered && (proposalReady || resolveComplete || resolveBlocked),
      advanced: true,
      // Advanced ID panels stay available but default Work does not force them open.
      workspace: Boolean(input.advancedOpen),
      collaborator: Boolean(input.advancedOpen),
      codeSession: Boolean(input.advancedOpen) || Boolean(autoResolve.code_session?.status === 'resolved'),
      describe: allAnswered,
      review: allAnswered,
      dispatch: allAnswered && (proposalCommitted || dispatched || Boolean(input.taskRunId)),
      events: allAnswered && (proposalReady || resolveComplete || Boolean(input.taskRunId)),
      retention: allAnswered && (proposalReady || resolveComplete),
      runtimeSurface: Boolean(input.codeSessionLoaded),
      advancedIds: true
    },
    flags: {
      allAnswered,
      resolveComplete,
      proposalReady,
      proposalCommitted,
      dispatched,
      acceptedStateAuthority: false,
      scopedGrantUnchanged: true,
      autoMutated: false,
      autoDispatched: false,
      rawShaHidden: true,
      tenH4Distinct: true
    },
    intentText: composeIntentFromAnswers(answers)
  };
}


/** Steps give_access must not wait on — terminal as skipped when that intent is chosen. */
export const GIVE_ACCESS_SKIP_STEP_IDS = Object.freeze([
  'code_session',
  'source_repos_base_commits',
  'task_run_events'
]);

/** Statuses that end a resolve row (no spinner). */
export function isTerminalResolveStatus(status) {
  return status === 'resolved' || status === 'skipped' || status === 'blocked';
}

/**
 * Required auto-resolve step ids for an intent.
 * give_access: workspace + access readiness + ids only.
 */
export function requiredAutoResolveStepIds(actionId = '') {
  const action = String(actionId || '').trim();
  if (action === 'give_access') {
    return WORK_AUTO_RESOLVE_STEPS
      .map((s) => s.id)
      .filter((id) => !GIVE_ACCESS_SKIP_STEP_IDS.includes(id));
  }
  return WORK_AUTO_RESOLVE_STEPS.map((s) => s.id);
}

/**
 * Intent-aware completion: skipped counts as terminal success for required steps;
 * blocked on a required step sets resolveBlocked.
 */
export function computeResolveCompletion(autoResolve = {}, actionId = '') {
  const normalized = normalizeAutoResolve(autoResolve);
  const required = requiredAutoResolveStepIds(actionId);
  const resolveComplete = required.every((id) => {
    const status = normalized[id]?.status;
    return status === 'resolved' || status === 'skipped';
  });
  const resolveBlocked = required.some((id) => normalized[id]?.status === 'blocked');
  return { resolveComplete, resolveBlocked, requiredStepIds: required };
}

/**
 * Build honest "Access to what?" choices from discovery + prefs.
 * Never invents Code Session ids — only surfaces what Conversation already bound.
 */
export function accessTargetChoicesFromDiscovery({
  sessions = [],
  workspaceId = '',
  conversationTitle = '',
  projectName = ''
} = {}) {
  const choices = [];
  const seen = new Set();
  const ws = String(workspaceId || '').trim();
  if (ws) {
    seen.add(`ws:${ws}`);
    const label = String(conversationTitle || projectName || '').trim();
    choices.push({
      id: `workspace:${ws}`,
      kind: 'workspace',
      value: ws,
      label: label ? `Workspace · ${label}` : 'This workspace'
    });
  }
  for (const session of Array.isArray(sessions) ? sessions : []) {
    const sessionWs = String(session?.workspaceId || '').trim();
    if (sessionWs && !seen.has(`ws:${sessionWs}`)) {
      seen.add(`ws:${sessionWs}`);
      const label = String(session?.conversationTitle || session?.projectName || '').trim();
      choices.push({
        id: `workspace:${sessionWs}`,
        kind: 'workspace',
        value: sessionWs,
        label: label ? `Workspace · ${label}` : 'Workspace from Chat'
      });
    }
    const cs = String(session?.codeSessionId || '').trim();
    if (cs && !seen.has(`cs:${cs}`)) {
      seen.add(`cs:${cs}`);
      const label = String(session?.conversationTitle || session?.projectName || '').trim();
      choices.push({
        id: `code_session:${cs}`,
        kind: 'code_session',
        value: cs,
        label: label ? `Code Session · ${label}` : 'Code Session bound via Chat',
        workspaceId: sessionWs || null,
        conversationId: session?.conversationId || null
      });
    }
  }
  choices.push({
    id: 'other_advanced',
    kind: 'other',
    value: null,
    label: 'Something else (Advanced / Share)'
  });
  return choices;
}

/** True when give_access cannot auto-pick a single concrete target. */
export function needsAccessTargetQuestion(actionId, choices = [], selectedTargetId = '') {
  if (String(actionId || '').trim() !== 'give_access') return false;
  if (String(selectedTargetId || '').trim()) return false;
  const concrete = (Array.isArray(choices) ? choices : []).filter((c) => c.kind !== 'other' && c.value);
  return concrete.length !== 1;
}

/** Seed all auto-resolve rows as resolving (UI before await). */
export function resolvingAutoResolvePlaceholder(actionId = '') {
  const action = String(actionId || '').trim();
  const out = {};
  for (const step of WORK_AUTO_RESOLVE_STEPS) {
    if (action === 'give_access' && GIVE_ACCESS_SKIP_STEP_IDS.includes(step.id)) {
      out[step.id] = {
        status: 'skipped',
        detail: 'Skipped for Give access — not required (no Code Session / pins / Task Run wait).',
        value: null
      };
    } else {
      out[step.id] = {
        status: 'resolving',
        detail: `Resolving ${step.label}…`,
        value: null
      };
    }
  }
  return out;
}

function normalizeAutoResolve(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const step of WORK_AUTO_RESOLVE_STEPS) {
    const row = src[step.id] || {};
    const status = ['pending', 'resolving', 'resolved', 'blocked', 'skipped'].includes(row.status)
      ? row.status
      : 'pending';
    out[step.id] = {
      id: step.id,
      label: step.label,
      status,
      detail: redactRawSha(row.detail || (status === 'pending' ? step.missing : '')),
      value: row.value == null ? null : row.value
    };
  }
  return out;
}

/**
 * Legacy 6-step guide model — still used when Advanced is driving visibility.
 * Default Work uses questionnaireModel instead.
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

  let current = WORK_ADVANCED_STEPS[0];
  for (const step of WORK_ADVANCED_STEPS) {
    current = step;
    if (!readiness[step.id]) break;
  }
  if (WORK_ADVANCED_STEPS.every(s => readiness[s.id])) {
    current = WORK_ADVANCED_STEPS[WORK_ADVANCED_STEPS.length - 1];
  }

  const ready = [];
  const missing = [];
  for (const step of WORK_ADVANCED_STEPS) {
    if (readiness[step.id]) ready.push(step.title);
    else missing.push(step.missing);
  }

  const allDone = WORK_ADVANCED_STEPS.every(s => readiness[s.id]);

  return {
    steps: WORK_ADVANCED_STEPS,
    currentStepId: current.id,
    stepNumber: current.number,
    stepCount: WORK_ADVANCED_STEPS.length,
    title: allDone ? 'Work flow ready' : `Step ${current.number} of ${WORK_ADVANCED_STEPS.length}`,
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

export function readWorkGuidePrefs(storage = sessionStorage) {
  try {
    return {
      workspaceId: String(storage.getItem(WORK_GUIDE_STORE.workspaceId) || '').trim(),
      collaboratorStepDone: storage.getItem(WORK_GUIDE_STORE.collaboratorDone) === '1',
      codeSessionFromDiscovery: storage.getItem(WORK_GUIDE_STORE.discoveryBound) === '1',
      answers: readJson(storage, WORK_GUIDE_STORE.answers, {}),
      autoResolve: readJson(storage, WORK_GUIDE_STORE.autoResolve, {})
    };
  } catch {
    return {
      workspaceId: '',
      collaboratorStepDone: false,
      codeSessionFromDiscovery: false,
      answers: {},
      autoResolve: {}
    };
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
    if ('answers' in partial) {
      writeJson(storage, WORK_GUIDE_STORE.answers, partial.answers || {});
    }
    if ('autoResolve' in partial) {
      writeJson(storage, WORK_GUIDE_STORE.autoResolve, partial.autoResolve || {});
    }
  } catch {
    /* ignore quota / private mode */
  }
}

function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value || {}));
  } catch {
    /* ignore */
  }
}

/**
 * Honest Code Session options from Conversation Session list rows.
 * Only rows with a non-empty code_session_id are selectable — never invent IDs.
 */
export function codeSessionsFromConversationList(payload) {
  const rows = payload?.sessions
    || payload?.conversations
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
    const conversationTitle = String(
      row?.title
      || row?.conversation_title
      || row?.name
      || row?.bindings?.title
      || ''
    ).trim();
    const projectName = String(
      row?.project_name
      || row?.bindings?.project_name
      || row?.workspace_name
      || ''
    ).trim();
    const sourceRepos = extractRepos(row);
    const baseCommits = extractBaseCommits(row);
    out.push({
      codeSessionId,
      conversationId: conversationId || null,
      workspaceId: workspaceId || null,
      conversationTitle: conversationTitle || null,
      projectName: projectName || null,
      sourceRepos,
      baseCommits,
      label: conversationTitle
        ? `Bound via Chat · ${conversationTitle}`
        : (conversationId ? 'Bound via Chat' : 'Code Session bound'),
      source: 'conversation_session'
    });
  }
  return out;
}

function extractRepos(row) {
  const raw = row?.source_repos
    || row?.bindings?.source_repos
    || row?.code_session?.source_repos
    || [];
  return Array.isArray(raw) ? raw.map((r) => String(r || '').trim()).filter(Boolean) : [];
}

function extractBaseCommits(row) {
  const raw = row?.base_commits
    || row?.bindings?.base_commits
    || row?.code_session?.base_commits
    || [];
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const repo = String(entry.repo || entry.repository || '').trim();
    const sha = String(entry.commit_sha || entry.sha || entry.base_commit_sha || '').trim();
    if (!repo) return null;
    return { repo, commit_sha: sha || null };
  }).filter(Boolean);
}

/** Friendly pin summary — never exposes raw SHA in default mode. */
export function summarizePins(sourceRepos = [], baseCommits = []) {
  const repos = Array.isArray(sourceRepos) ? sourceRepos.filter(Boolean) : [];
  const pins = Array.isArray(baseCommits) ? baseCommits.filter((p) => p?.repo) : [];
  if (!repos.length && !pins.length) {
    return { label: 'No repos resolved yet', detail: '', hasSha: false };
  }
  const repoLabel = repos.length
    ? `${repos.length} repo${repos.length === 1 ? '' : 's'}: ${repos.slice(0, 3).join(', ')}${repos.length > 3 ? '…' : ''}`
    : `${pins.length} pinned repo${pins.length === 1 ? '' : 's'}`;
  const pinLabel = pins.length
    ? `${pins.length} base pin${pins.length === 1 ? '' : 's'} (SHA hidden)`
    : 'No base pins reported';
  return {
    label: repoLabel,
    detail: pinLabel,
    hasSha: pins.some((p) => Boolean(p.commit_sha)),
    repos,
    // Default consumers must not render commit_sha; Advanced may.
    pinsForAdvanced: pins
  };
}

/** Human workspace label for default mode — never a truncated `ws:` fragment. */
export function workspaceHumanLabel({
  workspaceId = '',
  workspaceLabel = '',
  conversationTitle = '',
  projectName = '',
  fromPrefs = false
} = {}) {
  const explicit = String(workspaceLabel || conversationTitle || projectName || '').trim();
  if (explicit) return explicit;
  if (workspaceId || fromPrefs) return 'Saved workspace';
  return '';
}

/**
 * Parse a single human repo pick (`owner/repo` or `https://github.com/owner/repo`).
 * @returns {{ owner: string, repo: string, full: string } | null}
 */
export function parseRepoPick(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/$/, '');
  const parts = s.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1];
  if (!owner || !repo) return null;
  return { owner, repo, full: `${owner}/${repo}` };
}

/** Mint a Code Session ID for create calls — never shown as a default-mode field. */
export function mintCodeSessionId() {
  const uuid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `cs:${uuid}`;
}

/**
 * Extract resolved commit SHA from cairnstone_reconcile_repo (or similar) payloads.
 * Presentation keeps this off-screen in default mode.
 */
export function extractResolvedCommitSha(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = [
    payload.resolved_commit_sha,
    payload.resolved_commit,
    payload.commit_sha,
    payload.observed_commit_sha,
    payload.immutable_commit_sha,
    payload.ref_commit_sha,
    payload.commit?.sha,
    payload.resolved?.commit_sha,
    payload.summary?.resolved_commit_sha,
    payload.summary?.commit_sha,
    payload.github?.commit_sha,
    payload.tree?.commit_sha
  ];
  for (const c of candidates) {
    const sha = String(c || '').trim();
    if (/^[0-9a-f]{7,40}$/i.test(sha)) return sha.length >= 40 ? sha.slice(0, 40) : sha;
  }
  return '';
}

/**
 * Build the next auto-resolve snapshot from discovery payloads.
 * Presentation only — does not mint grants or dispatch.
 * Default-mode details never include truncated `ws:` / `cs:` / `tr:` fragments.
 */
export function buildAutoResolveSnapshot({
  workspaceId = '',
  workspaceLabel = '',
  conversationTitle = '',
  projectName = '',
  fromPrefs = false,
  hasWorkspaceCapability = false,
  codeSession = null,
  sourceRepos = [],
  baseCommits = [],
  taskRunId = '',
  proposalReady = false,
  eventsReady = false,
  needsRepoBranchPick = false,
  idBundle = {},
  actionId = '',
  needsAccessTargetPick = false,
  accessTargetId = '',
  mcpTimeout = false,
  mcpTimeoutDetail = ''
} = {}) {
  const action = String(actionId || '').trim();
  const isGiveAccess = action === 'give_access';
  const pins = summarizePins(sourceRepos, baseCommits);
  const idsResolved = isGiveAccess
    ? Boolean(workspaceId || idBundle.workspace_id || accessTargetId)
    : Boolean(
      (codeSession?.codeSessionId || idBundle.code_session_id)
      && (workspaceId || idBundle.workspace_id)
    );
  const humanWorkspace = workspaceHumanLabel({
    workspaceId,
    workspaceLabel,
    conversationTitle: conversationTitle || codeSession?.conversationTitle || '',
    projectName,
    fromPrefs
  });
  const boundViaChat = Boolean(codeSession?.codeSessionId && codeSession?.conversationId);
  const out = {
    workspace: workspaceId
      ? {
        status: 'resolved',
        detail: humanWorkspace && humanWorkspace !== 'Saved workspace'
          ? `Workspace ready · ${humanWorkspace}`
          : 'Workspace ready',
        value: workspaceId,
        label: humanWorkspace || 'Saved workspace'
      }
      : {
        status: 'blocked',
        detail: 'No workspace bound from Conversation Session or session prefs.',
        value: null,
        label: null
      },
    access_readiness: hasWorkspaceCapability
      ? {
        status: 'resolved',
        detail: 'Access readiness OK — grants / Invite remain explicit second-tap.',
        value: 'session_capability'
      }
      : {
        status: 'blocked',
        detail: 'Access readiness blocked — workspace capability missing in this browser session (never stoned).',
        value: null
      },
    code_session: isGiveAccess
      ? {
        status: 'skipped',
        detail: 'Skipped for Give access — Code Session not required.',
        value: null
      }
      : (codeSession?.codeSessionId
        ? {
          status: 'resolved',
          detail: boundViaChat ? 'Code Session bound via Chat' : 'Code Session bound',
          value: codeSession.codeSessionId
        }
        : {
          status: needsRepoBranchPick ? 'pending' : 'blocked',
          detail: needsRepoBranchPick
            ? 'Pick one repo + branch below — CairnStone resolves pins server-side (no commit hash or session-id field in default).'
            : 'No Conversation-bound Code Session yet. Pick a repo + branch in default Work, or use Advanced Create (raw SHA / session id) as escape hatch.',
          value: null
        }),
    source_repos_base_commits: isGiveAccess
      ? {
        status: 'skipped',
        detail: 'Skipped for Give access — repo pins not required.',
        value: null
      }
      : ((sourceRepos.length || baseCommits.length)
        ? {
          status: 'resolved',
          detail: `${pins.label} · ${pins.detail}`,
          value: { repos: pins.repos, pinCount: baseCommits.length }
        }
        : {
          status: codeSession?.codeSessionId ? 'blocked' : 'pending',
          detail: codeSession?.codeSessionId
            ? 'Code Session bound but repos/pins not reported yet.'
            : 'Waiting on Code Session before reading repos/pins.',
          value: null
        }),
    ids: idsResolved
      ? {
        status: 'resolved',
        detail: 'IDs ready (hidden in default mode).',
        value: {
          workspace_id: workspaceId || idBundle.workspace_id || null,
          code_session_id: codeSession?.codeSessionId || idBundle.code_session_id || null,
          conversation_id: codeSession?.conversationId || idBundle.conversation_id || null,
          task_run_id: taskRunId || idBundle.task_run_id || null
        }
      }
      : {
        status: needsAccessTargetPick ? 'blocked' : 'pending',
        detail: needsAccessTargetPick
          ? 'Access to what? Pick one target below — Console will not invent a Code Session.'
          : (isGiveAccess
            ? 'IDs resolve after workspace / access target is known.'
            : 'IDs resolve after workspace + Code Session bind.'),
        value: null
      },
    task_run_events: isGiveAccess
      ? {
        status: 'skipped',
        detail: 'Skipped for Give access — Task Run / events not required.',
        value: null
      }
      : ((proposalReady || taskRunId || eventsReady)
        ? {
          status: 'resolved',
          detail: taskRunId
            ? 'Task Run ready — Human Commit / Dispatch still second-tap'
            : 'Proposal / events surface ready — Human Commit / Dispatch still second-tap',
          value: taskRunId || 'proposal_ready'
        }
        : {
          status: 'pending',
          detail: 'Route intent after answers; never auto-dispatch.',
          value: null
        })
  };

  if (mcpTimeout) {
    const detail = String(mcpTimeoutDetail || 'MCP call timed out — retry resolve or open Advanced.').trim();
    for (const id of requiredAutoResolveStepIds(action)) {
      if (out[id]?.status === 'resolving' || out[id]?.status === 'pending') {
        out[id] = {
          ...out[id],
          status: 'blocked',
          detail,
          value: { code: 'MCP_TIMEOUT', cta: 'Retry resolve' }
        };
      }
    }
  }

  if (needsAccessTargetPick && isGiveAccess) {
    out.workspace = {
      status: 'blocked',
      detail: 'Access to what? Choose one human target — Give access will not wait on Code Session or invent one.',
      value: null,
      label: null
    };
  }

  return out;
}
