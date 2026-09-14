/**
 * Unit tests for V7.7.9c communications hub helpers.
 * Run: node --test comms-hub.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMS_SURFACES,
  commsHubBanner,
  commsListState,
  commsSubnavItems,
  filterActivityItems,
  groupMessagesByThread,
  handoffChainAllowed,
  intentLabel,
  normalizeMessageRow,
  sortMessagesNewestFirst
} from './comms-hub.js';

describe('comms hub intents', () => {
  it('exposes Inbox · Handoff · Activity with distinct intents', () => {
    const items = commsSubnavItems();
    assert.deepEqual(items.map(i => i.panel), ['inbox', 'handoff', 'activity']);
    assert.match(COMMS_SURFACES.inbox.intent, /Read/i);
    assert.match(COMMS_SURFACES.handoff.intent, /Dispatch/i);
    assert.match(COMMS_SURFACES.activity.intent, /activity/i);
  });

  it('banner preserves AC1 boundaries and no execution authority', () => {
    for (const panel of ['inbox', 'handoff', 'activity']) {
      const b = commsHubBanner(panel);
      assert.equal(b.grantsExecutionAuthority, false);
      assert.equal(b.acceptedStateAuthority, false);
      assert.match(b.identityNote, /stone_hash|message_id/);
      assert.match(b.scopeNote, /Scope/i);
    }
  });
});

describe('shared list / thread patterns', () => {
  const rows = [
    { message_id: 'm1', stone_hash: 'aaa', thread_id: 't1', subject: 'Hi', sender_id: 'a', intent: 'message', status: 'delivered', created_at: '2026-01-02T00:00:00Z' },
    { message_id: 'm2', stone_hash: 'bbb', thread_id: 't1', subject: 'Handoff', sender_id: 'b', intent: 'handoff', status: 'read', created_at: '2026-01-03T00:00:00Z', for: 'console:jared' },
    { message_id: 'm3', stone_hash: 'ccc', subject: 'Other', sender_id: 'c', intent: 'task_request', status: 'unread', created_at: '2026-01-01T00:00:00Z' }
  ];

  it('normalizes rows without inventing Scope association', () => {
    const n = normalizeMessageRow(rows[1], { surface: 'activity' });
    assert.equal(n.message_id, 'm2');
    assert.equal(n.stone_hash, 'bbb');
    assert.equal(n.intentLabel, 'Handoff');
    assert.equal(n.unread, false);
    assert.equal(n.scopeAssociated, false);
    assert.equal(n.grantsExecutionAuthority, false);
    assert.equal(n.recipient_id, 'console:jared');
  });

  it('filters activity and groups by thread', () => {
    const handoffs = filterActivityItems(rows, 'handoff');
    assert.equal(handoffs.length, 1);
    assert.equal(intentLabel('task_request'), 'Task request');
    const sorted = sortMessagesNewestFirst(rows);
    assert.equal(sorted[0].message_id, 'm2');
    const groups = groupMessagesByThread(rows);
    const t1 = groups.find(g => g.thread_id === 't1');
    assert.equal(t1.count, 2);
    assert.ok(groups.some(g => g.thread_id === '(no thread)'));
  });

  it('list states are explicit empty/loading/error', () => {
    assert.equal(commsListState({ loading: true }).status, 'loading');
    assert.equal(commsListState({ error: 'boom' }).status, 'error');
    assert.equal(commsListState({ count: 0, surface: 'inbox' }).status, 'empty');
    assert.equal(commsListState({ count: 2 }).status, 'ready');
  });

  it('handoff chain must be exact participating Scope chain', () => {
    assert.equal(handoffChainAllowed('chain-a', [{ chain: 'chain-a' }]), true);
    assert.equal(handoffChainAllowed('chain-b', [{ chain: 'chain-a' }]), false);
    assert.equal(handoffChainAllowed('', [{ chain: 'chain-a' }]), false);
  });
});
