import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAppendTurnArgs,
  buildJevNextActionArgs,
  buildNextActionCandidates,
  conversationDigest,
  conversationSearchMatches,
  latestTurnsByActor,
  normalizeConversationSession,
  normalizeTurnSyncPolicy,
  shouldSyncTurn
} from './turn-sync.js';

const sample = {
  conversation_id: 'cvs:test',
  status: 'active',
  session_revision: 3,
  created_by: 'console:jared',
  selected_actors: ['chatgpt:cairnstone-v6', 'claude:cairnstone-v6'],
  selected_chain: 'cairnstone-v6-project-memory',
  turns: [
    { turn_id: 'turn:1', message_id: 'cmsg:1', seq: 1, role: 'user', actor_id: 'console:jared', turn_type: 'task', content_preview: 'Check registration' },
    { turn_id: 'turn:2', message_id: 'cmsg:2', seq: 2, role: 'assistant', actor_id: 'chatgpt:cairnstone-v6', turn_type: 'task_result', content_preview: 'Persisted, tool missing' }
  ]
};

describe('TurnSync policy', () => {
  it('defaults to ask/full_turns and never grants accepted-state authority', () => {
    assert.deepEqual(normalizeTurnSyncPolicy({}), {
      mode: 'ask', payload: 'full_turns', standing_authorization: false,
      requires_per_turn_prompt: true, accepted_state_authority: false
    });
    assert.equal(shouldSyncTurn({ mode: 'off' }, sample.turns[0]), false);
    assert.equal(shouldSyncTurn({ mode: 'ask' }, sample.turns[0]), null);
    assert.equal(shouldSyncTurn({ mode: 'on', payload: 'decisions_tasks' }, sample.turns[0]), true);
  });
});

describe('Conversation normalization', () => {
  it('preserves exact actor/turn/message identity without inventing participants', () => {
    const s = normalizeConversationSession(sample);
    assert.equal(s.conversation_id, 'cvs:test');
    assert.equal(s.turns[1].actor_id, 'chatgpt:cairnstone-v6');
    assert.equal(s.turns[1].turn_id, 'turn:2');
    assert.equal(s.turns[1].message_id, 'cmsg:2');
    assert.ok(s.participants.includes('claude:cairnstone-v6'));
    assert.equal(s.accepted_state_authority, false);
  });

  it('latest actor turns omit turns with no attributable actor', () => {
    const latest = latestTurnsByActor([...sample.turns, { turn_id: 'turn:x', message_id: 'cmsg:x', seq: 9, role: 'system', content_preview: 'system' }]);
    assert.ok(latest.some(x => x.actor_id === 'chatgpt:cairnstone-v6'));
    assert.ok(!latest.some(x => x.actor_id === 'system'));
  });

  it('searches ids, actors and previews', () => {
    assert.equal(conversationSearchMatches(sample, 'claude'), true);
    assert.equal(conversationSearchMatches(sample, 'tool missing'), true);
    assert.equal(conversationSearchMatches(sample, 'unrelated'), false);
  });

  it('builds a deterministic digest and surfaces missing selected actors', () => {
    const d = conversationDigest(sample);
    assert.equal(d.turn_count, 2);
    assert.deepEqual(d.unresolved_actor_ids, ['claude:cairnstone-v6']);
    assert.match(d.note, /not an LLM summary/i);
  });
});

describe('Append + JEV boundaries', () => {
  it('builds append_turn arguments with CAS revision and no acceptance authority', () => {
    const built = buildAppendTurnArgs({
      conversationId: 'cvs:test', actorId: 'chatgpt:cairnstone-v6', baseRevision: 3,
      turn: { turn_id: 'turn:3', message_id: 'cmsg:3', role: 'assistant', turn_type: 'task_result', content_preview: 'Done' }
    });
    assert.equal(built.ok, true);
    assert.equal(built.tool, 'cairnstone_conversation_session_append_turn');
    assert.equal(built.args.base_revision, 3);
    assert.equal(built.accepted_state_authority, false);
  });

  it('uses JEV for next-action scoring rather than free-form summarization', () => {
    const candidates = buildNextActionCandidates(sample);
    assert.ok(candidates.some(x => x.id === 'request:claude:cairnstone-v6'));
    const built = buildJevNextActionArgs({ candidates });
    assert.equal(built.ok, true);
    assert.equal(built.args.kind, 'next_action');
    assert.ok(Array.isArray(built.args.candidates));
  });
});
