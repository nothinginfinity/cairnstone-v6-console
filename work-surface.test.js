/**
 * Unit tests for V7.7.9c Work surface helpers.
 * Run: node --test work-surface.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WORK_ACTION_CATALOG,
  actionCatalogFrom,
  workFirstPaintModel,
  workHonestyLine,
  workSurfaceState
} from './work-surface.js';

const sampleView = {
  ok: true,
  accepted_state_authority: false,
  console_grants_no_new_authority: true,
  project: { name: 'Demo Project', workspace_id: 'ws:demo' },
  persistent_code_session: {
    code_session_id: 'cs:demo-1',
    lifecycle: 'active',
    display: 'active · leased'
  },
  current_task: { task_id: 'task:1', title: 'Ship 9c Work surface', status: 'active' },
  actors: [
    { actor_id: 'console:jared', display: 'console:jared', status: 'idle' },
    { actor_id: 'claude:cs', display: 'claude:cs', status: 'working', detail: 'lease held' }
  ],
  tests: { summary: '3 passed' },
  working_tree: { summary: '2 drafts' },
  environment: { environment_id: 'env:1', status: 'attached' },
  sandbox: { status: 'detached' },
  leases: [{ lease_id: 'lease:1', actor_id: 'claude:cs' }],
  receipts: [{ receipt_id: 'rcpt:1' }],
  checkpoints: [{ checkpoint_id: 'cp:9' }],
  operator_surface: {
    project_value: 'Demo Project',
    session_value: 'active · leased',
    current_task_value: 'Ship 9c Work surface',
    tests_value: '3 passed',
    working_tree_value: '2 drafts'
  },
  actions: {
    invite_agent: { binds: { workspace_id: 'ws:demo' } },
    send_message: { suggested_body: 'Continue' }
  }
};

describe('workSurfaceState', () => {
  it('reports empty before load without inventing authority', () => {
    const s = workSurfaceState({});
    assert.equal(s.status, 'empty');
    assert.equal(s.acceptedStateAuthority, false);
    assert.match(s.body, /presentation/i);
  });

  it('reports loading and error explicitly', () => {
    assert.equal(workSurfaceState({ loading: true }).status, 'loading');
    assert.equal(workSurfaceState({ error: new Error('cap missing') }).status, 'error');
  });

  it('ready only when console_view ok', () => {
    const s = workSurfaceState({ loaded: true, data: sampleView });
    assert.equal(s.status, 'ready');
    assert.equal(s.acceptedStateAuthority, false);
  });
});

describe('workFirstPaintModel', () => {
  it('centers current task for first paint', () => {
    const m = workFirstPaintModel(sampleView);
    assert.equal(m.ok, true);
    assert.equal(m.currentTask, 'Ship 9c Work surface');
    assert.match(m.lifecycle, /active/);
    assert.equal(m.workspaceId, 'ws:demo');
    assert.equal(m.acceptedStateAuthority, false);
    assert.equal(m.consoleGrantsNoNewAuthority, true);
  });

  it('exposes progressive disclosure sections including environment and actions', () => {
    const m = workFirstPaintModel(sampleView);
    const ids = m.sections.map(s => s.id);
    assert.ok(ids.includes('actors'));
    assert.ok(ids.includes('working_tree'));
    assert.ok(ids.includes('environment'));
    assert.ok(ids.includes('actions'));
    assert.match(m.environment.summary, /attached|env/i);
    assert.equal(m.actors.length, 2);
  });

  it('action catalog never claims grants_authority', () => {
    const actions = actionCatalogFrom(sampleView);
    assert.ok(actions.length >= WORK_ACTION_CATALOG.length);
    for (const a of actions) {
      assert.equal(a.grants_authority, false);
    }
    assert.match(workHonestyLine(workFirstPaintModel(sampleView)), /accepted_state_authority: false/);
  });
});
