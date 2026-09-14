/**
 * Unit tests for V7.7.9d Universe v2 helpers.
 * Run: node --test universe-v2.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNIVERSE_VIEW_MODES,
  UNIVERSE_ZOOM_LEVELS,
  buildUniverseEntities,
  canZoomIn,
  canZoomOut,
  clampPanZoom,
  entityParity,
  focusFromScope,
  groupCatalogByRepo,
  layoutSpatialNodes,
  lodLoadPlan,
  normalizeViewMode,
  normalizeZoom,
  preserveSelection,
  scopeSelectorFromEntity,
  searchToFocus,
  universeSurfaceState,
  zoomIn,
  zoomLabel,
  zoomOut
} from './universe-v2.js';

const catalog = [
  { chain: 'alpha', canonical_head: 'aaa111', repos: ['org/alpha'], stone_count: 3 },
  { chain: 'beta', canonical_head: null, repos: ['org/alpha'], stone_count: 1 },
  { chain: 'gamma', canonical_head: 'ccc333', repos: ['org/gamma'], stone_count: 8 },
  { chain: 'orphan', canonical_head: 'ddd444', repos: [], stone_count: 2 }
];

describe('semantic zoom levels', () => {
  it('exposes Vault → Repo → Chain → Intelligence', () => {
    assert.deepEqual([...UNIVERSE_ZOOM_LEVELS], ['vault', 'repo', 'chain', 'intelligence']);
    assert.equal(zoomLabel('repo'), 'Repo');
    assert.equal(normalizeZoom('nope'), 'vault');
    assert.equal(zoomIn('vault'), 'repo');
    assert.equal(zoomIn('intelligence'), 'intelligence');
    assert.equal(zoomOut('repo'), 'vault');
    assert.equal(canZoomIn('chain'), true);
    assert.equal(canZoomOut('vault'), false);
  });

  it('view modes include spatial / list / grid', () => {
    assert.deepEqual([...UNIVERSE_VIEW_MODES], ['spatial', 'list', 'grid']);
    assert.equal(normalizeViewMode('GRID'), 'grid');
    assert.equal(normalizeViewMode('x'), 'spatial');
  });
});

describe('bounded LOD entities', () => {
  it('vault LOD lists repos from catalog provenance only', () => {
    const ents = buildUniverseEntities({ catalog, zoom: 'vault' });
    assert.ok(ents.some(e => e.type === 'vault'));
    assert.ok(ents.some(e => e.type === 'repo' && e.value === 'org/alpha'));
    assert.ok(ents.some(e => e.type === 'repo' && e.value === 'org/gamma'));
    assert.equal(ents.some(e => e.type === 'chain'), false);
    assert.equal(ents.every(e => e.type !== 'intelligence'), true);
  });

  it('repo LOD shows chains for focused repo', () => {
    const ents = buildUniverseEntities({
      catalog,
      zoom: 'repo',
      focus: { repo: 'org/alpha', type: 'repo', value: 'org/alpha' }
    });
    const chains = ents.filter(e => e.type === 'chain').map(e => e.value).sort();
    assert.deepEqual(chains, ['alpha', 'beta']);
  });

  it('intelligence LOD is bounded to one chain + orientation card', () => {
    const ents = buildUniverseEntities({
      catalog,
      zoom: 'intelligence',
      focus: { chain: 'gamma', type: 'chain', value: 'gamma' },
      intelligence: {
        start_here: { stone_hash: 'abc', title: 'START HERE', path: 'docs/x.md' },
        authority: { authority_manifest_id: 'sha256:1', full_path_head_count: 12, mode: 'start_here_orientation' }
      }
    });
    assert.equal(ents.filter(e => e.type === 'chain').length, 1);
    assert.ok(ents.some(e => e.type === 'intelligence' && /START HERE/.test(e.label)));
    assert.ok(ents.every(e => e.type !== 'repo' || true));
  });

  it('lodLoadPlan never requests vault-wide dump at intelligence', () => {
    const plan = lodLoadPlan({ zoom: 'intelligence', focus: { chain: 'gamma' } });
    assert.ok(plan.bounded);
    assert.equal(plan.intelligenceChain, 'gamma');
    assert.ok(plan.apis.includes('cairnstone_resume_chain'));
    assert.deepEqual(plan.resumeArgs, { chain: 'gamma', detail: 'start_here' });
    const vaultPlan = lodLoadPlan({ zoom: 'vault' });
    assert.deepEqual(vaultPlan.apis, ['cairnstone_vault_catalog']);
  });
});

describe('search-to-focus and selection preservation', () => {
  it('dims non-matches without mutating identity', () => {
    const ents = buildUniverseEntities({ catalog, zoom: 'vault' });
    const focused = searchToFocus(ents, 'gamma');
    const hit = focused.find(e => e.value === 'org/gamma');
    const miss = focused.find(e => e.value === 'org/alpha');
    assert.equal(hit.focused, true);
    assert.equal(hit.dimmed, false);
    assert.equal(miss.dimmed, true);
    assert.equal(hit.id, entityIdLike(hit));
  });

  it('preserves selection only when still in view', () => {
    const vault = buildUniverseEntities({ catalog, zoom: 'vault' });
    const repo = buildUniverseEntities({
      catalog,
      zoom: 'repo',
      focus: { repo: 'org/alpha', type: 'repo', value: 'org/alpha' }
    });
    const selected = ['repo:org/alpha', 'repo:org/gamma', 'chain:alpha'];
    assert.deepEqual(preserveSelection(selected, vault), ['repo:org/alpha', 'repo:org/gamma']);
    assert.deepEqual(preserveSelection(selected, repo), ['repo:org/alpha', 'chain:alpha']);
  });

  it('spatial/list/grid share entity parity at a LOD', () => {
    const ents = buildUniverseEntities({ catalog, zoom: 'vault' });
    const spatial = layoutSpatialNodes(ents, { zoom: 'vault' });
    assert.equal(entityParity(ents, spatial), true);
    assert.equal(entityParity(ents, ents.slice(0, -1)), false);
  });
});

describe('Scope selector mapping (no synthetic authority)', () => {
  it('maps vault/repo/chain to cairnstone-scope-v1 selectors', () => {
    assert.equal(scopeSelectorFromEntity({ type: 'vault', value: 'All CairnStone' }).mode, 'vault');
    assert.deepEqual(scopeSelectorFromEntity({ type: 'repo', value: 'org/x' }).repos, ['org/x']);
    assert.deepEqual(scopeSelectorFromEntity({ type: 'chain', value: 'c1' }).chains, ['c1']);
    assert.equal(scopeSelectorFromEntity({ type: 'intelligence', value: 'h' }).keepScope, true);
  });

  it('focusFromScope mirrors current Scope without inventing HEAD', () => {
    assert.equal(focusFromScope({ mode: 'vault' }).zoom, 'vault');
    assert.equal(focusFromScope({ mode: 'repo', repos: ['org/a'] }).repo, 'org/a');
    assert.equal(focusFromScope({ mode: 'single_chain', chains: ['c1'] }).chain, 'c1');
  });

  it('surface states stay presentation-only', () => {
    assert.equal(universeSurfaceState({ loading: true }).acceptedStateAuthority, false);
    assert.equal(universeSurfaceState({ error: 'x' }).status, 'error');
    assert.equal(universeSurfaceState({ loaded: true, entityCount: 0 }).status, 'empty');
    assert.equal(universeSurfaceState({ loaded: true, entityCount: 3, zoom: 'chain' }).status, 'ready');
  });

  it('groupCatalogByRepo uses provenance only', () => {
    const groups = groupCatalogByRepo(catalog);
    const alpha = groups.find(([r]) => r === 'org/alpha');
    assert.equal(alpha[1].length, 2);
    assert.ok(groups.some(([r]) => r.includes('no repository')));
  });

  it('pan/zoom clamps stay finite', () => {
    const t = clampPanZoom({ scale: 99, x: 9999, y: -9999 });
    assert.ok(t.scale <= 2.4);
    assert.ok(Math.abs(t.x) <= 420);
  });
});

function entityIdLike(e) {
  return `${e.type}:${e.value}`;
}
