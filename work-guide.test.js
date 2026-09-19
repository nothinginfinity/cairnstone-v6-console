/**
 * Unit tests for Zero-ID questionnaire Work model (+ Advanced 6-step guide).
 * Run: node --test work-guide.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORK_ADVANCED_STEPS,
  WORK_AUTO_RESOLVE_STEPS,
  WORK_GUIDE_STEPS,
  WORK_QUESTIONS,
  buildAutoResolveSnapshot,
  codeSessionsFromConversationList,
  composeIntentFromAnswers,
  extractResolvedCommitSha,
  humanActorOptions,
  mintCodeSessionId,
  parseRepoPick,
  questionnaireModel,
  readWorkGuidePrefs,
  redactRawSha,
  summarizePins,
  workGuideModel,
  workspaceHumanLabel,
  writeWorkGuidePrefs
} from './work-guide.js';

describe('questionnaireModel', () => {
  it('starts at What? with three human questions', () => {
    const m = questionnaireModel({});
    assert.equal(m.mode, 'zero_id_questionnaire');
    assert.equal(m.currentQuestionId, 'what');
    assert.equal(m.questionCount, 3);
    assert.equal(m.primaryCta.action, 'answer_what');
    assert.equal(m.visibility.autoResolve, false);
    assert.equal(m.flags.scopedGrantUnchanged, true);
    assert.equal(m.flags.autoDispatched, false);
    assert.equal(m.flags.rawShaHidden, true);
    assert.equal(m.flags.tenH4Distinct, true);
    assert.equal(m.flags.acceptedStateAuthority, false);
  });

  it('advances Who → What should they do one-at-a-time', () => {
    const afterWhat = questionnaireModel({
      answers: { what: 'Ship Zero-ID UX' },
      questionIndex: 1
    });
    assert.equal(afterWhat.currentQuestionId, 'who');
    assert.equal(afterWhat.primaryCta.action, 'answer_who');

    const afterWho = questionnaireModel({
      answers: {
        what: 'Ship Zero-ID UX',
        whoDisplay: 'Grok Bot',
        whoMailboxId: 'grok-bot:cairnstone-v6'
      },
      questionIndex: 2
    });
    assert.equal(afterWho.currentQuestionId, 'what_should_they_do');
    assert.equal(afterWho.primaryCta.action, 'answer_action');
  });

  it('after answers enters resolve/confirm without auto-dispatch', () => {
    const answers = {
      what: 'Ship Zero-ID UX',
      whoDisplay: 'Grok Bot',
      whoMailboxId: 'grok-bot:cairnstone-v6',
      actionId: 'assign',
      actionLabel: 'Assign / ask them to work'
    };
    const m = questionnaireModel({
      answers,
      questionIndex: 3,
      autoResolve: buildAutoResolveSnapshot({
        workspaceId: 'ws:demo',
        hasWorkspaceCapability: true,
        codeSession: { codeSessionId: 'cs:1', conversationId: 'cvs:1' },
        sourceRepos: ['nothinginfinity/cairnstone-v6-console'],
        baseCommits: [{ repo: 'nothinginfinity/cairnstone-v6-console', commit_sha: 'abcdef1234567890' }],
        proposalReady: true,
        taskRunId: ''
      }),
      proposalReady: true
    });
    assert.equal(m.allAnswered, true);
    assert.equal(m.visibility.autoResolve, true);
    assert.equal(m.visibility.confirm, true);
    assert.equal(m.flags.autoMutated, false);
    assert.equal(m.flags.autoDispatched, false);
    assert.match(m.autoResolve.source_repos_base_commits.detail, /SHA hidden|pin/i);
    assert.doesNotMatch(m.autoResolve.source_repos_base_commits.detail, /abcdef1234567890/);
    assert.equal(m.primaryCta.action, 'focus_review');
  });

  it('exposes exactly three default questions and six auto-resolve targets', () => {
    assert.deepEqual(WORK_QUESTIONS.map((q) => q.id), ['what', 'who', 'what_should_they_do']);
    assert.equal(WORK_AUTO_RESOLVE_STEPS.length, 6);
    assert.deepEqual(
      WORK_ADVANCED_STEPS.map((s) => s.id),
      ['choose_workspace', 'add_collaborator', 'code_session', 'describe_work', 'review_commit', 'dispatch_watch']
    );
    assert.equal(WORK_GUIDE_STEPS, WORK_ADVANCED_STEPS);
  });
});

describe('composeIntentFromAnswers + actors + SHA redaction', () => {
  it('composes human intent without requiring raw IDs in the text', () => {
    const text = composeIntentFromAnswers({
      what: 'Close the questionnaire gap',
      whoDisplay: 'Claude',
      whoMailboxId: 'claude:cairnstone-v6',
      actionLabel: 'Assign / ask them to work'
    });
    assert.match(text, /What: Close the questionnaire gap/);
    assert.match(text, /Who: Claude/);
    assert.match(text, /Assign/);
    assert.doesNotMatch(text, /claude:cairnstone-v6/);
  });

  it('actor picker options use human display names', () => {
    const opts = humanActorOptions();
    assert.ok(opts.some((o) => o.display === 'Grok Bot'));
    assert.ok(opts.every((o) => o.display && !/^[^:]+:cairnstone-v6$/.test(o.display)));
  });

  it('redacts raw SHAs in default-mode copy', () => {
    assert.equal(redactRawSha('pin abcdef1 and deadbeefcafebabe'), 'pin ·pin· and ·pin·');
    const pins = summarizePins(
      ['owner/repo'],
      [{ repo: 'owner/repo', commit_sha: '0123456789abcdef0123456789abcdef01234567' }]
    );
    assert.match(pins.detail, /SHA hidden/);
    assert.doesNotMatch(pins.detail, /0123456789abcdef/);
  });
});

describe('buildAutoResolveSnapshot', () => {
  it('blocks honestly when discovery is empty and never claims grant minting', () => {
    const snap = buildAutoResolveSnapshot({});
    assert.equal(snap.workspace.status, 'blocked');
    assert.equal(snap.access_readiness.status, 'blocked');
    assert.equal(snap.code_session.status, 'blocked');
    assert.match(snap.access_readiness.detail, /second-tap|capability|session|Access readiness/i);
  });

  it('uses human default labels without truncated ws:/cs:/tr: fragments', () => {
    const snap = buildAutoResolveSnapshot({
      workspaceId: 'ws:very-long-workspace-identifier-abcdef',
      workspaceLabel: 'Console Zero-ID',
      fromPrefs: true,
      hasWorkspaceCapability: true,
      codeSession: {
        codeSessionId: 'cs:very-long-code-session-identifier',
        conversationId: 'cvs:chat-1'
      },
      sourceRepos: ['nothinginfinity/cairnstone-v6-console'],
      baseCommits: [{ repo: 'nothinginfinity/cairnstone-v6-console', commit_sha: 'abcdef1234567890abcdef1234567890abcdef12' }],
      taskRunId: 'tr:very-long-task-run-identifier',
      proposalReady: true
    });
    assert.equal(snap.workspace.detail, 'Workspace ready · Console Zero-ID');
    assert.doesNotMatch(snap.workspace.detail, /ws:|…/);
    assert.equal(snap.code_session.detail, 'Code Session bound via Chat');
    assert.doesNotMatch(snap.code_session.detail, /cs:|cvs:|…/);
    assert.equal(snap.task_run_events.detail, 'Task Run ready — Human Commit / Dispatch still second-tap');
    assert.doesNotMatch(snap.task_run_events.detail, /tr:|…/);
    assert.doesNotMatch(snap.source_repos_base_commits.detail, /abcdef1234567890/);
  });

  it('asks for default repo+branch pick when no Conversation-bound session', () => {
    const snap = buildAutoResolveSnapshot({
      workspaceId: 'ws:demo',
      hasWorkspaceCapability: true,
      needsRepoBranchPick: true
    });
    assert.equal(snap.code_session.status, 'pending');
    assert.match(snap.code_session.detail, /repo \+ branch/i);
    assert.doesNotMatch(snap.code_session.detail, /\bcs:/);
  });
});

describe('workspaceHumanLabel + repo pick helpers', () => {
  it('prefers conversation/project title then Saved workspace', () => {
    assert.equal(workspaceHumanLabel({ conversationTitle: 'Ops chat' }), 'Ops chat');
    assert.equal(workspaceHumanLabel({ workspaceId: 'ws:x', fromPrefs: true }), 'Saved workspace');
    assert.equal(workspaceHumanLabel({}), '');
  });

  it('parses owner/repo picks and extracts reconcile SHAs without exposing them in UI helpers', () => {
    assert.deepEqual(parseRepoPick('nothinginfinity/cairnstone-v6-console'), {
      owner: 'nothinginfinity',
      repo: 'cairnstone-v6-console',
      full: 'nothinginfinity/cairnstone-v6-console'
    });
    assert.equal(
      extractResolvedCommitSha({ summary: { resolved_commit_sha: 'abcdef1234567890abcdef1234567890abcdef12' } }),
      'abcdef1234567890abcdef1234567890abcdef12'
    );
    assert.match(mintCodeSessionId(), /^cs:/);
  });
});

describe('workGuideModel (Advanced 6-step)', () => {
  it('starts at choose workspace with one primary CTA', () => {
    const m = workGuideModel({});
    assert.equal(m.currentStepId, 'choose_workspace');
    assert.equal(m.stepNumber, 1);
    assert.equal(m.stepCount, 6);
    assert.equal(m.primaryCta.action, 'save_workspace');
    assert.equal(m.visibility.collaborator, false);
    assert.equal(m.visibility.describe, false);
    assert.equal(m.visibility.events, false);
    assert.equal(m.flags.acceptedStateAuthority, false);
    assert.equal(m.flags.scopedGrantUnchanged, true);
  });

  it('reveals collaborator only after workspace + capability', () => {
    const m = workGuideModel({
      workspaceId: 'ws:demo',
      hasWorkspaceCapability: true
    });
    assert.equal(m.currentStepId, 'add_collaborator');
    assert.equal(m.visibility.collaborator, true);
    assert.equal(m.visibility.codeSession, false);
  });

  it('requires honest Code Session before Intent / Events / Retention', () => {
    const blocked = workGuideModel({
      workspaceId: 'ws:demo',
      hasWorkspaceCapability: true,
      collaboratorStepDone: true,
      codeSessionId: '',
      workDescription: 'do stuff'
    });
    assert.equal(blocked.currentStepId, 'code_session');
    assert.equal(blocked.visibility.describe, false);
    assert.equal(blocked.visibility.events, false);
    assert.equal(blocked.visibility.retention, false);

    const ready = workGuideModel({
      workspaceId: 'ws:demo',
      hasWorkspaceCapability: true,
      collaboratorStepDone: true,
      codeSessionId: 'cs:demo-1',
      codeSessionFromDiscovery: true,
      codeSessionLoaded: true
    });
    assert.equal(ready.currentStepId, 'describe_work');
    assert.equal(ready.visibility.describe, true);
    assert.equal(ready.visibility.events, true);
    assert.equal(ready.visibility.retention, true);
  });

  it('progresses through describe → review → dispatch', () => {
    const base = {
      workspaceId: 'ws:demo',
      hasWorkspaceCapability: true,
      collaboratorStepDone: true,
      codeSessionId: 'cs:1',
      codeSessionLoaded: true,
      codeSessionFromDiscovery: true
    };
    assert.equal(workGuideModel({ ...base, workDescription: 'Ship guide' }).currentStepId, 'review_commit');
    assert.equal(
      workGuideModel({ ...base, workDescription: 'Ship guide', proposalCommitted: true }).currentStepId,
      'dispatch_watch'
    );
    const done = workGuideModel({
      ...base,
      workDescription: 'Ship guide',
      proposalCommitted: true,
      dispatched: true,
      taskRunId: 'tr:1'
    });
    assert.equal(done.flags.allDone, true);
    assert.equal(done.primaryCta.action, 'focus_dispatch');
  });
});

describe('codeSessionsFromConversationList', () => {
  it('only returns rows with real code_session_id (no invented select)', () => {
    const opts = codeSessionsFromConversationList({
      sessions: [
        { conversation_id: 'cvs:1', code_session_id: 'cs:a', workspace_id: 'ws:1' },
        { conversation_id: 'cvs:2' },
        { conversation_id: 'cvs:3', bindings: { code_session_id: 'cs:a' } },
        { conversation_id: 'cvs:4', code_session_id: 'cs:b' }
      ]
    });
    assert.equal(opts.length, 2);
    assert.equal(opts[0].codeSessionId, 'cs:a');
    assert.equal(opts[0].source, 'conversation_session');
    assert.equal(opts[1].codeSessionId, 'cs:b');
    assert.doesNotMatch(opts[0].label, /^cs:a · via/);
  });

  it('returns empty for missing or empty payloads', () => {
    assert.deepEqual(codeSessionsFromConversationList(null), []);
    assert.deepEqual(codeSessionsFromConversationList({ sessions: [] }), []);
  });
});

describe('workGuidePrefs storage', () => {
  it('round-trips presentation prefs without storing capabilities', () => {
    const mem = new Map();
    const storage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => { mem.set(k, String(v)); },
      removeItem: (k) => { mem.delete(k); }
    };
    writeWorkGuidePrefs({
      workspaceId: 'ws:x',
      collaboratorStepDone: true,
      codeSessionFromDiscovery: true,
      answers: { what: 'demo', whoDisplay: 'Grok' },
      autoResolve: { workspace: { status: 'resolved' } }
    }, storage);
    const prefs = readWorkGuidePrefs(storage);
    assert.equal(prefs.workspaceId, 'ws:x');
    assert.equal(prefs.collaboratorStepDone, true);
    assert.equal(prefs.codeSessionFromDiscovery, true);
    assert.equal(prefs.answers.what, 'demo');
    assert.equal(prefs.autoResolve.workspace.status, 'resolved');
    assert.equal([...mem.keys()].some(k => /capabilit|token|secret/i.test(k)), false);
  });
});
