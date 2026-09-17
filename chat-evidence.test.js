/**
 * Unit tests for V7.7.9b Chat config + evidence drawer helpers.
 * Run: node --test chat-evidence.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canOpenEvidenceDrawer,
  chatConfigState,
  evidenceDrawerModel,
  evidenceDrawerSummary
} from './chat-evidence.js';

const grounded = {
  schema: 'cairnstone-grounded-response-v1',
  response_id: 'gr:abc123',
  response_lod: 2,
  scope_id: 'scope:1',
  authority_digest: 'digest:1',
  accepted_state_authority: false,
  chain_heads_mutated: false,
  path_heads_mutated: false,
  authority_freshness: { stale: false, status: 'current' },
  evidence: [
    { chain: 'cairnstone-v6-project-memory', path: 'docs/x.md', stone_hash: 'aaa', authority_class: 'accepted', commit_sha: '0123456789ab' }
  ],
  skeleton: {
    claims: [{ text: 'Console is presentation only', stone_hash: 'aaa', ref_id: 'c1' }]
  },
  telemetry: { evidence_count: 1 },
  materialized_response_lods: [1, 2],
  provider_envelope: { provider: 'workers_ai', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' }
};

describe('chatConfigState', () => {
  it('keeps route inactive for default Answer Depth on single-chain', () => {
    const s = chatConfigState({ single: true, toolDelegate: false, scopeResolved: true });
    assert.equal(s.routeActive, false);
    assert.equal(s.toolDelegateAvailable, true);
    assert.equal(s.routeControlsEnabled, false);
    assert.equal(s.routeControlsEditable, true);
    assert.equal(s.acceptedStateAuthority, false);
    assert.match(s.honesty, /grounded_response/);
  });

  it('enables route only for single-chain tool delegation', () => {
    const s = chatConfigState({ single: true, toolDelegate: true, scopeResolved: true });
    assert.equal(s.routeActive, true);
    assert.equal(s.routeControlsEnabled, true);
    assert.match(s.honesty, /cairnstone_delegate/);
  });

  it('blocks tool delegation honesty for multi-chain Scope', () => {
    const s = chatConfigState({ single: false, toolDelegate: false, scopeResolved: true });
    assert.equal(s.toolDelegateAvailable, false);
    assert.equal(s.routeControlsEnabled, false);
    assert.match(s.honesty, /multi-chain/);
    assert.match(s.routeNote, /does not imply/);
  });
});

describe('evidenceDrawerModel', () => {
  it('is not openable without a grounded response', () => {
    assert.equal(canOpenEvidenceDrawer(null), false);
    assert.equal(evidenceDrawerModel({}).openable, false);
  });

  it('binds sections to the same response_id without inventing authority', () => {
    const model = evidenceDrawerModel(grounded);
    assert.equal(model.openable, true);
    assert.equal(model.responseId, 'gr:abc123');
    assert.equal(model.strip.acceptedStateAuthority, false);
    const ids = model.sections.map(s => s.id);
    assert.deepEqual(ids, ['identity', 'freshness', 'citations', 'claims', 'receipt', 'depth']);
    const identity = model.sections.find(s => s.id === 'identity');
    assert.equal(identity.rows.find(r => r[0] === 'accepted_state_authority')[1], 'false');
    const citations = model.sections.find(s => s.id === 'citations');
    assert.equal(citations.items.length, 1);
    const claims = model.sections.find(s => s.id === 'claims');
    assert.match(claims.items[0].title, /presentation only/);
    assert.match(evidenceDrawerSummary(grounded), /same response_id/);
  });
});
