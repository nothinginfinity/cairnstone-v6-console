/**
 * V7.7.9d — Universe v2 helpers (presentation only).
 * Semantic zoom Vault → Repo → Chain → Intelligence over the same Scope selectors.
 * Spatial layout never invents graph edges, HEADs, or accepted-state authority.
 */

export const UNIVERSE_ZOOM_LEVELS = Object.freeze(['vault', 'repo', 'chain', 'intelligence']);
export const UNIVERSE_VIEW_MODES = Object.freeze(['spatial', 'list', 'grid']);
export const UNIVERSE_ZOOM_LABELS = Object.freeze({
  vault: 'Vault',
  repo: 'Repo',
  chain: 'Chain',
  intelligence: 'Intelligence'
});

/** Max entities rendered at each LOD (bounded neighbors — no vault-wide dump at deep LOD). */
export const UNIVERSE_LOD_BOUNDS = Object.freeze({
  vault: { repos: 48, chains: 0 },
  repo: { repos: 1, chains: 64 },
  chain: { repos: 8, chains: 48 },
  intelligence: { repos: 1, chains: 1, intelligence: 12 }
});

const NO_REPO = '(no repository provenance)';

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    const s = typeof v === 'string' ? v.trim() : String(v);
    if (s) return s;
  }
  return null;
}

export function normalizeZoom(level) {
  const z = String(level || '').toLowerCase();
  return UNIVERSE_ZOOM_LEVELS.includes(z) ? z : 'vault';
}

export function normalizeViewMode(mode) {
  const m = String(mode || '').toLowerCase();
  return UNIVERSE_VIEW_MODES.includes(m) ? m : 'spatial';
}

export function zoomLabel(level) {
  return UNIVERSE_ZOOM_LABELS[normalizeZoom(level)] || 'Vault';
}

export function zoomIn(level) {
  const z = normalizeZoom(level);
  const i = UNIVERSE_ZOOM_LEVELS.indexOf(z);
  return UNIVERSE_ZOOM_LEVELS[Math.min(UNIVERSE_ZOOM_LEVELS.length - 1, i + 1)];
}

export function zoomOut(level) {
  const z = normalizeZoom(level);
  const i = UNIVERSE_ZOOM_LEVELS.indexOf(z);
  return UNIVERSE_ZOOM_LEVELS[Math.max(0, i - 1)];
}

export function canZoomIn(level) {
  return normalizeZoom(level) !== 'intelligence';
}

export function canZoomOut(level) {
  return normalizeZoom(level) !== 'vault';
}

/**
 * Entity identity used across spatial / list / grid — same canonical Scope selectors.
 */
export function entityId(type, value) {
  return `${type}:${value}`;
}

export function parseEntityId(id) {
  const s = String(id || '');
  const i = s.indexOf(':');
  if (i <= 0) return null;
  return { type: s.slice(0, i), value: s.slice(i + 1) };
}

/**
 * Group catalog rows by repository provenance (presentation grouping only).
 */
export function groupCatalogByRepo(catalog = []) {
  const map = new Map();
  for (const row of catalog || []) {
    const repos = Array.isArray(row?.repos) && row.repos.length ? row.repos : [NO_REPO];
    for (const repo of repos) {
      const key = repo || NO_REPO;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([repo, chains]) => [
      repo,
      [...chains].sort((a, b) => String(a.chain || '').localeCompare(String(b.chain || '')))
    ]);
}

/**
 * Derive focus from current Scope when opening Universe (no new authority).
 */
export function focusFromScope(scope = {}, snapshot = null) {
  const mode = scope?.mode || 'vault';
  if (mode === 'vault') return { zoom: 'vault', type: 'vault', value: 'All CairnStone', repo: null, chain: null };
  if (mode === 'repo' && scope.repos?.[0]) {
    return { zoom: 'repo', type: 'repo', value: scope.repos[0], repo: scope.repos[0], chain: null };
  }
  const chain = scope.chains?.[0] || snapshot?.chains?.[0]?.chain || null;
  if (chain) {
    return { zoom: 'chain', type: 'chain', value: chain, repo: null, chain };
  }
  return { zoom: 'vault', type: 'vault', value: 'All CairnStone', repo: null, chain: null };
}

/**
 * Preserve selection across zoom/view when identity remains in the visible set.
 */
export function preserveSelection(selectionIds = [], visibleEntities = []) {
  const visible = new Set((visibleEntities || []).map(x => x.id || entityId(x.type, x.value)));
  return (selectionIds || []).filter(id => visible.has(id));
}

/**
 * Search-to-focus: mark matches without mutating accepted state.
 */
export function searchToFocus(entities = [], query = '') {
  const q = String(query || '').trim().toLowerCase();
  return (entities || []).map(ent => {
    const hay = `${ent.label || ''} ${ent.value || ''} ${ent.meta || ''} ${ent.type || ''}`.toLowerCase();
    const match = !q || hay.includes(q);
    return {
      ...ent,
      match,
      focused: Boolean(q) && match,
      dimmed: Boolean(q) && !match
    };
  });
}

/**
 * Build the current-LOD entity set from catalog (+ optional intelligence card).
 * Never invents edges; repository membership comes from catalog provenance only.
 */
export function buildUniverseEntities({
  catalog = [],
  zoom = 'vault',
  focus = null,
  intelligence = null,
  bounds = UNIVERSE_LOD_BOUNDS
} = {}) {
  const level = normalizeZoom(zoom);
  const groups = groupCatalogByRepo(catalog);
  const lim = bounds[level] || bounds.vault;
  const entities = [];

  entities.push({
    id: entityId('vault', 'All CairnStone'),
    type: 'vault',
    value: 'All CairnStone',
    label: 'All CairnStone',
    meta: `${groups.length} repos · catalog`,
    depth: 0
  });

  if (level === 'vault') {
    for (const [repo, chains] of groups.slice(0, lim.repos)) {
      if (repo === NO_REPO) continue;
      entities.push({
        id: entityId('repo', repo),
        type: 'repo',
        value: repo,
        label: repo,
        meta: `${chains.length} chain${chains.length === 1 ? '' : 's'}`,
        depth: 1,
        chainCount: chains.length
      });
    }
    return entities;
  }

  const focusRepo = firstNonEmpty(focus?.repo, focus?.type === 'repo' ? focus.value : null);
  const focusChain = firstNonEmpty(focus?.chain, focus?.type === 'chain' ? focus.value : null);

  if (level === 'repo') {
    const repoKey = focusRepo || groups.find(([r]) => r !== NO_REPO)?.[0] || null;
    if (!repoKey) return entities;
    const chains = groups.find(([r]) => r === repoKey)?.[1] || [];
    entities.push({
      id: entityId('repo', repoKey),
      type: 'repo',
      value: repoKey,
      label: repoKey,
      meta: `${chains.length} chains in focus`,
      depth: 1,
      focusedHost: true
    });
    for (const row of chains.slice(0, lim.chains)) {
      entities.push(chainEntity(row, 2));
    }
    return entities;
  }

  if (level === 'chain') {
    // Bounded neighbors: focused repo's chains, else a small slice of catalog chains.
    let rows = [];
    if (focusRepo) {
      rows = groups.find(([r]) => r === focusRepo)?.[1] || [];
      entities.push({
        id: entityId('repo', focusRepo),
        type: 'repo',
        value: focusRepo,
        label: focusRepo,
        meta: 'parent repo (presentation)',
        depth: 1
      });
    } else {
      rows = (catalog || []).slice();
    }
    if (focusChain && !rows.some(r => r.chain === focusChain)) {
      const hit = (catalog || []).find(r => r.chain === focusChain);
      if (hit) rows = [hit, ...rows];
    }
    for (const row of rows.slice(0, lim.chains)) {
      entities.push(chainEntity(row, 2, row.chain === focusChain));
    }
    return entities;
  }

  // intelligence — single focused chain + bounded orientation card fields
  const chainName = focusChain || (catalog || [])[0]?.chain || null;
  if (!chainName) return entities;
  const row = (catalog || []).find(r => r.chain === chainName) || { chain: chainName };
  entities.push(chainEntity(row, 2, true));

  const card = intelligence?.start_here || intelligence?.canonical_head || intelligence || null;
  if (card) {
    const hash = card.stone_hash || card.hash || null;
    const title = card.title || 'HEAD orientation';
    const path = card.path || intelligence?.provenance?.path || null;
    entities.push({
      id: entityId('intelligence', hash || title),
      type: 'intelligence',
      value: hash || title,
      label: title,
      meta: [path, hash ? shortHash(hash) : null].filter(Boolean).join(' · ') || 'orientation',
      depth: 3,
      headHash: hash || null,
      path: path || null,
      presentationOnly: true
    });
    const auth = intelligence?.authority;
    if (auth) {
      entities.push({
        id: entityId('intelligence', `authority:${auth.authority_manifest_id || 'digest'}`),
        type: 'intelligence',
        value: auth.authority_manifest_id || 'authority',
        label: 'Accepted-authority digest',
        meta: [
          auth.mode || null,
          auth.full_path_head_count != null ? `${auth.full_path_head_count} path heads (digest only)` : null
        ].filter(Boolean).join(' · '),
        depth: 3,
        presentationOnly: true
      });
    }
  } else {
    entities.push({
      id: entityId('intelligence', 'pending'),
      type: 'intelligence',
      value: 'pending',
      label: 'Loading orientation…',
      meta: 'Bounded resume_chain / manifest_v2',
      depth: 3,
      pending: true,
      presentationOnly: true
    });
  }
  return entities.slice(0, 2 + (lim.intelligence || 12));
}

function chainEntity(row, depth, focusedHost = false) {
  const chain = row.chain || row.value;
  return {
    id: entityId('chain', chain),
    type: 'chain',
    value: chain,
    label: chain,
    meta: row.canonical_head ? `HEAD ${shortHash(row.canonical_head)}` : 'no HEAD',
    depth,
    headless: !row.canonical_head,
    focusedHost,
    stoneCount: row.stone_count,
    repos: row.repos || []
  };
}

function shortHash(v) {
  const s = String(v || '');
  return s.length > 16 ? `${s.slice(0, 10)}…${s.slice(-4)}` : s;
}

/**
 * Lightweight Prax-inspired radial / ring layout (CSS % coords). Presentation only.
 */
export function layoutSpatialNodes(entities = [], { zoom = 'vault', width = 100, height = 100 } = {}) {
  const level = normalizeZoom(zoom);
  const vault = entities.find(x => x.type === 'vault');
  const repos = entities.filter(x => x.type === 'repo');
  const chains = entities.filter(x => x.type === 'chain');
  const intel = entities.filter(x => x.type === 'intelligence');
  const placed = [];

  if (vault) placed.push({ ...vault, x: 50, y: 50, size: level === 'vault' ? 'lg' : 'sm' });

  if (level === 'vault') {
    repos.forEach((r, i) => {
      const angle = (Math.PI * 2 * i / Math.max(1, repos.length)) - Math.PI / 2;
      placed.push({
        ...r,
        x: clamp(50 + Math.cos(angle) * 36, 6, 94),
        y: clamp(50 + Math.sin(angle) * 34, 8, 92),
        size: 'md'
      });
    });
    return placed;
  }

  if (level === 'repo') {
    const host = repos[0];
    if (host) placed.push({ ...host, x: 50, y: 42, size: 'lg' });
    chains.forEach((c, i) => {
      const angle = (Math.PI * 2 * i / Math.max(1, chains.length)) - Math.PI / 2;
      placed.push({
        ...c,
        x: clamp(50 + Math.cos(angle) * 28, 8, 92),
        y: clamp(50 + Math.sin(angle) * 30, 12, 90),
        size: 'md'
      });
    });
    return placed;
  }

  if (level === 'chain') {
    const host = repos[0];
    if (host) placed.push({ ...host, x: 18, y: 18, size: 'sm' });
    const n = chains.length;
    const cols = Math.max(2, Math.ceil(Math.sqrt(n)));
    chains.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rows = Math.ceil(n / cols) || 1;
      placed.push({
        ...c,
        x: clamp(22 + (col + 0.5) * (66 / cols), 10, 92),
        y: clamp(22 + (row + 0.5) * (66 / rows), 14, 90),
        size: c.focusedHost ? 'lg' : 'md'
      });
    });
    return placed;
  }

  // intelligence
  const host = chains[0];
  if (host) placed.push({ ...host, x: 50, y: 28, size: 'lg' });
  intel.forEach((item, i) => {
    const angle = (Math.PI * 2 * i / Math.max(1, intel.length)) - Math.PI / 2;
    placed.push({
      ...item,
      x: clamp(50 + Math.cos(angle) * 22, 12, 88),
      y: clamp(58 + Math.sin(angle) * 16, 42, 88),
      size: 'md'
    });
  });
  void width; void height;
  return placed;
}

/**
 * LOD load plan — only current LOD / bounded neighbors via existing read APIs.
 */
export function lodLoadPlan({ zoom = 'vault', focus = null } = {}) {
  const level = normalizeZoom(zoom);
  if (level === 'vault' || level === 'repo' || level === 'chain') {
    return {
      apis: ['cairnstone_vault_catalog'],
      reason: 'Catalog provenance for Vault/Repo/Chain projection',
      bounded: true,
      intelligenceChain: null
    };
  }
  const chain = firstNonEmpty(focus?.chain, focus?.type === 'chain' ? focus.value : null);
  return {
    apis: ['cairnstone_resume_chain', 'cairnstone_manifest_v2'],
    reason: 'Bounded Intelligence orientation for one focused chain',
    bounded: true,
    intelligenceChain: chain,
    resumeArgs: chain ? { chain, detail: 'start_here' } : null,
    manifestArgs: chain ? { chain, detail: 'orientation' } : null
  };
}

/**
 * Map a Universe entity click to a cairnstone-scope-v1 selector (same as list/Scope sheet).
 * Intelligence nodes do not invent Scope — they keep chain focus.
 */
export function scopeSelectorFromEntity(entity, { multiMode = false, multiSelection = null } = {}) {
  if (!entity) return null;
  if (entity.type === 'vault') {
    return { mode: 'vault', max_chains: 200, label: 'All CairnStone' };
  }
  if (entity.type === 'repo') {
    if (entity.value === NO_REPO) return null;
    return { mode: 'repo', repos: [entity.value], max_chains: 200, label: `Repo · ${entity.value}` };
  }
  if (entity.type === 'chain') {
    if (multiMode && multiSelection) {
      return { multiToggle: entity.value };
    }
    return { mode: 'single_chain', chains: [entity.value], max_chains: 200, label: entity.value };
  }
  if (entity.type === 'intelligence') {
    return { keepScope: true, focusOnly: true };
  }
  return null;
}

/**
 * Explicit empty / loading / error / ready for Universe surface.
 */
export function universeSurfaceState({
  loaded = false,
  loading = false,
  error = null,
  entityCount = 0,
  zoom = 'vault'
} = {}) {
  if (loading) {
    return {
      status: 'loading',
      title: 'Loading Universe…',
      body: `Fetching bounded ${zoomLabel(zoom)} LOD from existing MCP read APIs. Console does not invent catalog or HEAD state.`,
      acceptedStateAuthority: false
    };
  }
  if (error) {
    return {
      status: 'error',
      title: 'Universe unavailable',
      body: String(error.message || error || 'Load failed'),
      acceptedStateAuthority: false
    };
  }
  if (!loaded) {
    return {
      status: 'empty',
      title: 'Universe not loaded',
      body: 'Open Bird\'s Eye after the vault catalog resolves. Projection uses the same Scope selectors as the context bar.',
      acceptedStateAuthority: false
    };
  }
  if (!entityCount) {
    return {
      status: 'empty',
      title: 'No entities at this LOD',
      body: 'Try zooming out or clearing search. Spatial position never creates graph edges.',
      acceptedStateAuthority: false
    };
  }
  return {
    status: 'ready',
    title: `Universe · ${zoomLabel(zoom)}`,
    body: 'Presentation only — same canonical Scope selectors as list/search.',
    acceptedStateAuthority: false
  };
}

/**
 * Whether two view modes show the same entity identity set (parity check helper).
 */
export function entityParity(a = [], b = []) {
  const sa = new Set((a || []).map(x => x.id || entityId(x.type, x.value)));
  const sb = new Set((b || []).map(x => x.id || entityId(x.type, x.value)));
  if (sa.size !== sb.size) return false;
  for (const id of sa) if (!sb.has(id)) return false;
  return true;
}

/**
 * Touch / pan transform helpers (CSS matrix values — presentation only).
 */
export function clampPanZoom({ scale = 1, x = 0, y = 0 } = {}) {
  return {
    scale: clamp(Number(scale) || 1, 0.55, 2.4),
    x: clamp(Number(x) || 0, -420, 420),
    y: clamp(Number(y) || 0, -420, 420)
  };
}

export function panZoomStyle(transform) {
  const t = clampPanZoom(transform);
  return `transform: translate(${t.x}px, ${t.y}px) scale(${t.scale}); transform-origin: center center;`;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
