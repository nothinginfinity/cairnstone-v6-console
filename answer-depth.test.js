/**
 * Unit tests for V7.7.8c Answer Depth helpers (no live MCP required).
 * Run: node --test answer-depth.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorityStrip,
  clampResponseLod,
  isStalePayload,
  loadDepthPrefs,
  parseAnswerDepthCommand,
  resolveDefaultDepth,
  setCodeSessionDefaultDepth,
  setThreadDefaultDepth,
  staleActionsFromPayload
} from './answer-depth.js';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); }
  };
}

describe('parseAnswerDepthCommand', () => {
  it('parses LOD expand phrases', () => {
    assert.equal(parseAnswerDepthCommand('LOD 3 that.').type, 'expand');
    assert.equal(parseAnswerDepthCommand('LOD 3 that.').response_lod, 3);
    assert.equal(parseAnswerDepthCommand('Give me the LOD 5 version.').response_lod, 5);
    assert.equal(parseAnswerDepthCommand('show me lod 2').response_lod, 2);
  });

  it('parses thread default phrases', () => {
    const cmd = parseAnswerDepthCommand('Keep this conversation at LOD 1 unless I expand.');
    assert.equal(cmd.type, 'set_thread_default');
    assert.equal(cmd.response_lod, 1);
  });

  it('parses code session default phrases', () => {
    const cmd = parseAnswerDepthCommand('Use LOD 2 by default for this Code Session.');
    assert.equal(cmd.type, 'set_code_session_default');
    assert.equal(cmd.response_lod, 2);
  });

  it('falls through to ask for ordinary questions', () => {
    const cmd = parseAnswerDepthCommand('What is the current START HERE?');
    assert.equal(cmd.type, 'ask');
    assert.match(cmd.question, /START HERE/);
  });
});

describe('presentation default depth storage', () => {
  it('stores thread and code-session defaults without inventing authority', () => {
    const storage = memoryStorage();
    setThreadDefaultDepth('thread:a', 3, storage);
    setCodeSessionDefaultDepth('cs_123', 2, storage);
    assert.equal(resolveDefaultDepth({ threadId: 'thread:a', storage }), 3);
    assert.equal(resolveDefaultDepth({ threadId: 'thread:a', codeSessionId: 'cs_123', storage }), 2);
    assert.equal(resolveDefaultDepth({ threadId: 'other', storage }), 1);
    const prefs = loadDepthPrefs(storage);
    assert.equal(prefs.threadDefaults['thread:a'], 3);
    assert.equal(prefs.codeSessionDefaults.cs_123, 2);
  });

  it('clamps invalid lod values', () => {
    assert.equal(clampResponseLod(9, 1), 1);
    assert.equal(clampResponseLod('3', 1), 3);
  });
});

describe('stale / authority strip', () => {
  it('labels current vs stale authority', () => {
    assert.equal(authorityStrip({
      schema: 'cairnstone-grounded-response-v1',
      response_id: 'gr:1',
      response_lod: 1,
      authority_freshness: { stale: false, status: 'current' },
      telemetry: { evidence_count: 2 }
    }).label, 'Authority: Current ✓');

    const stale = authorityStrip({
      schema: 'cairnstone-grounded-response-v1',
      response_id: 'gr:1',
      response_lod: 1,
      authority_freshness: { stale: true, status: 'authority_changed' },
      evidence: [{}, {}, {}]
    });
    assert.equal(stale.tone, 'stale');
    assert.equal(stale.evidenceCount, 3);
  });

  it('detects stale expand payloads and actions', () => {
    const payload = {
      ok: false,
      error: 'stale_response',
      reason: 'authority_changed',
      actions: {
        view_original: { params: { view_original: true, response_lod: 3 } },
        refresh: { params: { refresh_of: 'gr:1' } }
      }
    };
    assert.equal(isStalePayload(payload), true);
    const actions = staleActionsFromPayload(payload);
    assert.equal(actions.view_original, true);
    assert.equal(actions.refresh, true);
  });
});
