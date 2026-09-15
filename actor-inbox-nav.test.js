/**
 * Unit tests for Actor Inbox Navigator (presentation / discovery).
 * Run: node --test actor-inbox-nav.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_SUFFIX,
  SEED_ACTORS,
  WORK_SUFFIX,
  actorCardModel,
  actorPickerPrompt,
  buildActorDirectory,
  collectObservedIdsFromMessages,
  defaultHandoffRecipients,
  filterMessagesByPlane,
  mailboxPlaneBadge,
  mergeObservedIds,
  normalizeInboxSelection,
  normalizeMultiSelection,
  parseLegacyActorField,
  parseMailboxId,
  planesAvailable,
  recipientIdsForSelection,
  summarizeActorFromMessages,
  summarizeMailboxStats
} from './actor-inbox-nav.js';

describe('canonical mailbox conventions', () => {
  it('keeps durable work suffix cairnstone-v6 (not v7)', () => {
    assert.equal(WORK_SUFFIX, 'cairnstone-v6');
    assert.equal(CHAT_SUFFIX, 'chat');
    assert.ok(SEED_ACTORS.every(a => !JSON.stringify(a).includes('cairnstone-v7')));
    const claude = SEED_ACTORS.find(a => a.key === 'claude');
    assert.equal(claude.mailboxes.chat, 'claude:chat');
    assert.equal(claude.mailboxes.work, 'claude:cairnstone-v6');
  });

  it('seeds Grok, Claude, ChatGPT, Grok Bot', () => {
    assert.deepEqual(SEED_ACTORS.map(a => a.display), ['Grok', 'Claude', 'ChatGPT', 'Grok Bot']);
  });

  it('uses human prompts instead of developer field labels', () => {
    assert.equal(actorPickerPrompt('inbox'), 'Choose inbox');
    assert.equal(actorPickerPrompt('activity'), 'Whose activity?');
    assert.equal(actorPickerPrompt('handoff'), 'Choose recipients');
  });
});

describe('parse + directory discovery', () => {
  it('parses chat / work / custom planes', () => {
    assert.equal(parseMailboxId('grok:chat').plane, 'chat');
    assert.equal(parseMailboxId('grok:cairnstone-v6').plane, 'work');
    assert.equal(parseMailboxId('console:jared').plane, 'other');
    assert.equal(mailboxPlaneBadge('chatgpt:chat').label, 'Chat');
    assert.equal(mailboxPlaneBadge('chatgpt:cairnstone-v6').label, 'Work');
  });

  it('builds directory from seeds + observed traffic without inventing authority', () => {
    const dir = buildActorDirectory({
      observedIds: [
        'console:jared',
        'nova:chat',
        'claude:cairnstone-v6',
        'someone-else:weird-plane'
      ]
    });
    const keys = dir.map(a => a.key);
    assert.ok(keys.includes('grok'));
    assert.ok(keys.includes('claude'));
    assert.ok(keys.includes('console'));
    assert.ok(keys.includes('nova'));
    assert.ok(keys.includes('someone-else'));

    const consoleActor = dir.find(a => a.key === 'console');
    assert.deepEqual(consoleActor.mailboxes.other, ['console:jared']);
    assert.equal(consoleActor.mailboxes.chat, undefined);
    assert.equal(consoleActor.mailboxes.work, undefined);

    const nova = dir.find(a => a.key === 'nova');
    assert.equal(nova.mailboxes.chat, 'nova:chat');
    assert.equal(nova.mailboxes.work, 'nova:cairnstone-v6');
    assert.equal(nova.hasBothPlanes, true);

    const weird = dir.find(a => a.key === 'someone-else');
    assert.deepEqual(weird.mailboxes.other, ['someone-else:weird-plane']);
  });

  it('recipientIdsForSelection supports All · Chat · Work', () => {
    const [claude] = buildActorDirectory({ observedIds: [] }).filter(a => a.key === 'claude');
    assert.deepEqual(recipientIdsForSelection(claude, 'all'), ['claude:chat', 'claude:cairnstone-v6']);
    assert.deepEqual(recipientIdsForSelection(claude, 'chat'), ['claude:chat']);
    assert.deepEqual(recipientIdsForSelection(claude, 'work'), ['claude:cairnstone-v6']);
    assert.deepEqual(planesAvailable(claude), ['all', 'chat', 'work']);
  });

  it('handoff defaults to work mailbox', () => {
    const grokBot = buildActorDirectory({}).find(a => a.key === 'grok-bot');
    assert.deepEqual(defaultHandoffRecipients(grokBot), ['grok-bot:cairnstone-v6']);
    assert.deepEqual(planesAvailable(grokBot), ['all', 'work']);
  });
});

describe('stats + plane filtering', () => {
  const msgs = [
    { message_id: '1', for: 'claude:chat', status: 'delivered', subject: 'Hi', created_at: '2026-01-02T00:00:00Z' },
    { message_id: '2', for: 'claude:cairnstone-v6', status: 'read', subject: 'Done', created_at: '2026-01-03T00:00:00Z' },
    { message_id: '3', for: 'claude:cairnstone-v6', status: 'delivered', subject: 'Wait', created_at: '2026-01-04T00:00:00Z' }
  ];

  it('summarizes unread and recent activity from existing listing rows', () => {
    const stats = summarizeActorFromMessages(msgs);
    assert.equal(stats.total, 3);
    assert.equal(stats.unread, 2);
    assert.equal(stats.latest.subject, 'Wait');
    assert.equal(stats.planeUnread.chat, 1);
    assert.equal(stats.planeUnread.work, 1);
  });

  it('filters combined mailbox by plane', () => {
    assert.equal(filterMessagesByPlane(msgs, 'all').length, 3);
    assert.equal(filterMessagesByPlane(msgs, 'chat').length, 1);
    assert.equal(filterMessagesByPlane(msgs, 'work').length, 2);
  });

  it('collects observed sender/recipient IDs from correspondence', () => {
    const ids = collectObservedIdsFromMessages([
      { sender_id: 'grok:chat', for: 'console:jared' },
      { sender_id: 'claude:cairnstone-v6', recipient_id: 'chatgpt:chat' }
    ]);
    assert.ok(ids.includes('grok:chat'));
    assert.ok(ids.includes('console:jared'));
    assert.ok(ids.includes('chatgpt:chat'));
    assert.deepEqual(mergeObservedIds(['a'], ['b', 'a']), ['a', 'b']);
  });

  it('summarizeMailboxStats handles empty input', () => {
    const empty = summarizeMailboxStats({});
    assert.equal(empty.unread, 0);
    assert.equal(empty.total, 0);
    assert.equal(empty.latest, null);
  });
});

describe('selection helpers', () => {
  const dir = buildActorDirectory({ observedIds: ['console:jared'] });

  it('normalizes inbox selection + plane', () => {
    const sel = normalizeInboxSelection({ actorKey: 'claude', plane: 'chat' }, dir);
    assert.equal(sel.actorKey, 'claude');
    assert.equal(sel.plane, 'chat');
    const fallback = normalizeInboxSelection({ actorKey: 'missing', plane: 'nope' }, dir);
    assert.ok(fallback.actorKey);
    assert.equal(fallback.plane, 'all');
  });

  it('supports multi-select without comma-separated primary UX', () => {
    const multi = normalizeMultiSelection(['claude', 'grok', 'nope'], dir);
    assert.deepEqual(multi, ['claude', 'grok']);
    const legacy = parseLegacyActorField('console:jared, claude:cairnstone-v6');
    assert.deepEqual(legacy.ids, ['console:jared', 'claude:cairnstone-v6']);
    assert.ok(legacy.keys.includes('console'));
    assert.ok(legacy.keys.includes('claude'));
  });

  it('actor card model exposes badges and unread for picker', () => {
    const claude = dir.find(a => a.key === 'claude');
    const card = actorCardModel(claude, {
      selected: true,
      stats: { unread: 2, total: 5, latest: { subject: 'Ping' } },
      mode: 'single'
    });
    assert.equal(card.display, 'Claude');
    assert.equal(card.selected, true);
    assert.equal(card.unread, 2);
    assert.equal(card.recent, 'Ping');
    assert.ok(card.badges.some(b => b.label === 'Chat'));
    assert.ok(card.badges.some(b => b.label === 'Work'));
  });
});
