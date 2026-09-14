/**
 * Unit tests for V7.7.9e Saved Views serialize/parse/open.
 * Run: node --test saved-views.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVED_VIEWS_SCHEMA,
  SAVED_VIEWS_STORE_KEY,
  assertNoAuthorityFreeze,
  buildOpenPlan,
  captureCurrentView,
  compareFreshness,
  deleteSavedView,
  loadSavedViewsStore,
  openSavedView,
  parseSavedView,
  sanitizeScopeSelector,
  serializeSavedView,
  upsertSavedView
} from './saved-views.js';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); }
  };
}

describe('sanitizeScopeSelector', () => {
  it('keeps selectors only and drops HEAD / digest fields', () => {
    const out = sanitizeScopeSelector({
      mode: 'multi',
      chains: ['b-chain', 'a-chain'],
      head_hash: 'deadbeef',
      authority_digest: 'should-drop',
      path_heads: [{ path: 'x', stone_hash: 'y' }],
      max_chains: 50
    });
    assert.deepEqual(out, {
      mode: 'multi',
      chains: ['a-chain', 'b-chain'],
      max_chains: 50
    });
    assert.equal('head_hash' in out, false);
    assert.equal('authority_digest' in out, false);
  });

  it('normalizes repo and vault modes', () => {
    assert.equal(sanitizeScopeSelector({ mode: 'vault' }).mode, 'vault');
    assert.deepEqual(
      sanitizeScopeSelector({ mode: 'repo', repos: ['nothinginfinity/cairnstone-v6'] }).repos,
      ['nothinginfinity/cairnstone-v6']
    );
  });
});

describe('serializeSavedView / parseSavedView', () => {
  it('serializes presentation + selectors without secrets', () => {
    const view = serializeSavedView({
      id: 'sv:test',
      name: 'Platform',
      scopeSelector: { mode: 'single_chain', chains: ['cairnstone-v6-project-memory'] },
      presentation: {
        primary: 'universe',
        panel: 'universe',
        universeLod: 'chain',
        universeViewMode: 'list',
        filters: { universeSearch: 'project-memory', stonesQuery: '' },
        disclosure: { scopePickerOpen: false, workSectionsOpen: ['actors'] }
      },
      freshnessHint: {
        authority_digest: 'abc123',
        scope_id: 'scope:1'
      }
    }, { now: () => '2026-09-14T00:00:00.000Z' });

    assert.equal(view.schema, SAVED_VIEWS_SCHEMA);
    assert.equal(view.name, 'Platform');
    assert.equal(view.presentation.universeLod, 'chain');
    assert.equal(view.presentation.filters.universeSearch, 'project-memory');
    assert.equal(view.freshnessHint.authority_digest, 'abc123');
    assert.match(view.note, /not accepted/i);
    assert.equal(view.acceptedStateAuthority, undefined);
    assertNoAuthorityFreeze(view);
  });

  it('rejects empty names and strips secret-like keys', () => {
    assert.throws(() => serializeSavedView({ name: '  ' }), /name/i);
    const view = serializeSavedView({
      name: 'Safe',
      scopeSelector: { mode: 'vault' },
      presentation: { primary: 'chat', panel: 'chat' },
      operator_token: 'SHOULD_NOT_APPEAR',
      workspace_capability: 'SHOULD_NOT_APPEAR'
    });
    const json = JSON.stringify(view);
    assert.doesNotMatch(json, /SHOULD_NOT_APPEAR/);
    assert.doesNotMatch(json, /operator_token/);
  });

  it('parseSavedView recovers valid records and rejects garbage', () => {
    const good = serializeSavedView({
      name: 'Music',
      scopeSelector: { mode: 'repo', repos: ['nothinginfinity/music'] },
      presentation: { primary: 'work', panel: 'code' }
    });
    assert.equal(parseSavedView(good)?.name, 'Music');
    assert.equal(parseSavedView(null), null);
    assert.equal(parseSavedView({ name: '', scopeSelector: {} }), null);
  });
});

describe('store upsert / delete', () => {
  it('persists to localStorage-compatible storage', () => {
    const storage = memoryStorage();
    const a = upsertSavedView({
      name: 'Everything',
      scopeSelector: { mode: 'vault' },
      presentation: { primary: 'chat', panel: 'chat' }
    }, storage);
    const b = upsertSavedView({
      name: 'Platform',
      scopeSelector: { mode: 'single_chain', chains: ['cairnstone-v6-project-memory'] },
      presentation: { primary: 'more', panel: 'stones', filters: { stonesQuery: 'START' } }
    }, storage);
    const store = loadSavedViewsStore(storage);
    assert.equal(store.views.length, 2);
    assert.ok(storage.getItem(SAVED_VIEWS_STORE_KEY));
    assert.equal(deleteSavedView(a.id, storage), true);
    assert.equal(loadSavedViewsStore(storage).views.map(v => v.id).join(','), b.id);
  });
});

describe('openSavedView + freshness', () => {
  it('buildOpenPlan requires fresh Scope resolve and never claims accepted authority', () => {
    const view = serializeSavedView({
      name: 'Open me',
      scopeSelector: { mode: 'single_chain', chains: ['cairnstone-v6-project-memory'] },
      presentation: { primary: 'inbox', panel: 'handoff', universeLod: 'repo', universeViewMode: 'grid' }
    });
    const plan = buildOpenPlan(view);
    assert.equal(plan.ok, true);
    assert.equal(plan.mustResolveScope, true);
    assert.equal(plan.acceptedStateAuthority, false);
    assert.equal(plan.panel, 'handoff');
    assert.equal(plan.universeViewMode, 'grid');
  });

  it('openSavedView applies presentation then re-resolves Scope via hook', async () => {
    const view = captureCurrentView({
      name: 'Live open',
      scope: { mode: 'multi', chains: ['chain-a', 'chain-b'] },
      primary: 'more',
      panel: 'authorize',
      universeLod: 'vault',
      universeViewMode: 'spatial',
      filters: { stonesQuery: 'auth' },
      disclosure: { authorizeArgsOpen: false, authorizeRawOpen: false },
      scopeSnapshot: { authority_digest: 'old-digest', scope_id: 'scope:old' }
    });

    const calls = { presentation: null, selector: null, freshness: null };
    const result = await openSavedView(view, {
      applyPresentation(p) { calls.presentation = p; },
      async resolveScope(selector) {
        calls.selector = selector;
        return { scope_id: 'scope:new', authority_digest: 'new-digest', chains: [{ chain: 'chain-a' }] };
      },
      onFreshness(f) { calls.freshness = f; }
    });

    assert.equal(result.ok, true);
    assert.equal(result.acceptedStateAuthority, false);
    assert.equal(calls.presentation.panel, 'authorize');
    assert.equal(calls.presentation.filters.stonesQuery, 'auth');
    assert.deepEqual(calls.selector.chains, ['chain-a', 'chain-b']);
    assert.equal(calls.freshness.status, 'heads_may_have_moved');
    assert.match(calls.freshness.message, /not accepted-state/i);
  });

  it('fails closed when resolveScope hook is missing', async () => {
    const view = serializeSavedView({
      name: 'No hook',
      scopeSelector: { mode: 'vault' },
      presentation: { primary: 'chat', panel: 'chat' }
    });
    const result = await openSavedView(view, {
      applyPresentation() {}
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /resolveScope/i);
    assert.equal(result.acceptedStateAuthority, false);
  });

  it('compareFreshness is honest without treating hint as truth', () => {
    const moved = compareFreshness(
      { authority_digest: 'a' },
      { authority_digest: 'b', scope_id: 's' }
    );
    assert.equal(moved.headsMayHaveMoved, true);
    assert.equal(moved.acceptedStateAuthority, false);

    const fresh = compareFreshness(null, { authority_digest: 'x', scope_id: 's' });
    assert.equal(fresh.status, 'resolved_fresh');
    assert.match(fresh.message, /never freeze/i);
  });
});
