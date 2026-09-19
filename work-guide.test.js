/**
 * Unit tests for guided operator Work flow model.
 * Run: node --test work-guide.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORK_GUIDE_STEPS,
  codeSessionsFromConversationList,
  readWorkGuidePrefs,
  workGuideModel,
  writeWorkGuidePrefs
} from './work-guide.js';

describe('workGuideModel', () => {
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

  it('exposes six named steps in order', () => {
    assert.deepEqual(
      WORK_GUIDE_STEPS.map(s => s.id),
      ['choose_workspace', 'add_collaborator', 'code_session', 'describe_work', 'review_commit', 'dispatch_watch']
    );
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
      codeSessionFromDiscovery: true
    }, storage);
    const prefs = readWorkGuidePrefs(storage);
    assert.equal(prefs.workspaceId, 'ws:x');
    assert.equal(prefs.collaboratorStepDone, true);
    assert.equal(prefs.codeSessionFromDiscovery, true);
    assert.equal([...mem.keys()].some(k => /capabilit|token|secret/i.test(k)), false);
  });
});
