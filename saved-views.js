/**
 * V7.7.9e — Saved Views (presentation / navigation convenience only).
 * Stores selectors + UI prefs in browser localStorage.
 * Never stores secrets, operator tokens, workspace capabilities, or frozen HEADs as accepted truth.
 * Opening a Saved View must re-resolve Scope via cairnstone_resolve_scope.
 */

export const SAVED_VIEWS_STORE_KEY = 'cs.savedViews.v1';
export const SAVED_VIEWS_SCHEMA = 'cairnstone-console-saved-view-v1';
export const SAVED_VIEWS_VERSION = 1;

export const PRIMARY_SURFACES = Object.freeze(['chat', 'work', 'universe', 'inbox', 'more']);
export const PANEL_IDS = Object.freeze([
  'chat', 'code', 'universe', 'inbox', 'handoff', 'activity',
  'stones', 'evidence', 'authorize', 'invite', 'settings'
]);
export const SCOPE_MODES = Object.freeze(['single_chain', 'repo', 'multi', 'vault']);
export const UNIVERSE_LODS = Object.freeze(['vault', 'repo', 'chain', 'intelligence']);
export const UNIVERSE_VIEW_MODES = Object.freeze(['spatial', 'list', 'grid']);

const FORBIDDEN_SCOPE_KEYS = Object.freeze([
  'head_hash', 'heads', 'path_heads', 'path_head', 'authority_digest',
  'scope_id', 'accepted_state', 'accepted_state_authority', 'token',
  'bearer', 'operator_token', 'workspace_capability', 'capability', 'secret'
]);

const SECRET_KEYS = Object.freeze([
  'token', 'bearer', 'operator_token', 'operatorToken', 'workspace_capability',
  'workspaceCapability', 'capability', 'password', 'secret', 'authorization'
]);

function asTrimmed(v) {
  if (v == null) return '';
  return String(v).trim();
}

function uniqueSorted(list) {
  return [...new Set((Array.isArray(list) ? list : []).map(asTrimmed).filter(Boolean))].sort();
}

/**
 * Strip authority / secret fields from a Scope-like object.
 * Selectors only: mode + chains/repos + max_chains.
 */
export function sanitizeScopeSelector(raw, { defaultChain = 'cairnstone-v6-project-memory' } = {}) {
  const x = raw && typeof raw === 'object' ? raw : {};
  for (const key of FORBIDDEN_SCOPE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(x, key) && x[key] != null && x[key] !== '') {
      // Drop silently — callers should never rely on these as accepted truth.
    }
  }
  const mode = SCOPE_MODES.includes(x.mode) ? x.mode : 'single_chain';
  const max = Math.min(500, Math.max(1, Number(x.max_chains || 200) || 200));
  const out = { mode, max_chains: max };
  if (mode === 'single_chain') {
    const chain = asTrimmed((x.chains || [defaultChain])[0]) || defaultChain;
    out.chains = [chain];
  } else if (mode === 'multi') {
    out.chains = uniqueSorted(x.chains);
    if (!out.chains.length) {
      return { mode: 'single_chain', chains: [defaultChain], max_chains: max };
    }
  } else if (mode === 'repo') {
    out.repos = uniqueSorted(x.repos);
    if (!out.repos.length) {
      return { mode: 'single_chain', chains: [defaultChain], max_chains: max };
    }
  }
  return out;
}

export function normalizePrimary(primary, panel) {
  const p = asTrimmed(primary).toLowerCase();
  if (PRIMARY_SURFACES.includes(p)) return p;
  const panelId = asTrimmed(panel).toLowerCase();
  if (panelId === 'code') return 'work';
  if (['inbox', 'handoff', 'activity'].includes(panelId)) return 'inbox';
  if (['stones', 'evidence', 'authorize', 'invite', 'settings'].includes(panelId)) return 'more';
  if (panelId === 'universe') return 'universe';
  return 'chat';
}

export function normalizePanel(panel, primary) {
  const id = asTrimmed(panel).toLowerCase();
  if (PANEL_IDS.includes(id)) return id === 'work' ? 'code' : id;
  const prim = normalizePrimary(primary, id);
  return ({
    chat: 'chat',
    work: 'code',
    universe: 'universe',
    inbox: 'inbox',
    more: 'stones'
  })[prim] || 'chat';
}

function sanitizeFilters(raw) {
  const f = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const key of ['stonesQuery', 'universeSearch', 'scopeSearch', 'activityFilter']) {
    const v = asTrimmed(f[key]);
    if (v) out[key] = v.slice(0, 500);
  }
  return out;
}

function sanitizeDisclosure(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  if (typeof d.scopePickerOpen === 'boolean') out.scopePickerOpen = d.scopePickerOpen;
  if (typeof d.scopeAdvancedOpen === 'boolean') out.scopeAdvancedOpen = d.scopeAdvancedOpen;
  if (typeof d.stonesDetailOpen === 'boolean') out.stonesDetailOpen = d.stonesDetailOpen;
  if (typeof d.stonesRawOpen === 'boolean') out.stonesRawOpen = d.stonesRawOpen;
  if (typeof d.authorizeArgsOpen === 'boolean') out.authorizeArgsOpen = d.authorizeArgsOpen;
  if (typeof d.authorizeRawOpen === 'boolean') out.authorizeRawOpen = d.authorizeRawOpen;
  if (Array.isArray(d.workSectionsOpen)) {
    out.workSectionsOpen = d.workSectionsOpen.map(asTrimmed).filter(Boolean).slice(0, 20);
  }
  if (Array.isArray(d.evidenceSectionsOpen)) {
    out.evidenceSectionsOpen = d.evidenceSectionsOpen.map(asTrimmed).filter(Boolean).slice(0, 20);
  }
  return out;
}

/**
 * Optional presentation-only freshness hint (never accepted authority).
 * Used solely to show "heads may have moved" honesty after re-resolve.
 */
function sanitizeFreshnessHint(raw) {
  const h = raw && typeof raw === 'object' ? raw : {};
  const digest = asTrimmed(h.authority_digest || h.lastSeenAuthorityDigest);
  const scopeId = asTrimmed(h.scope_id || h.lastSeenScopeId);
  if (!digest && !scopeId) return null;
  return {
    authority_digest: digest || null,
    scope_id: scopeId || null,
    note: 'Presentation hint only — not accepted project truth. Re-resolve on open.'
  };
}

export function sanitizePresentation(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const panel = normalizePanel(p.panel, p.primary);
  const primary = normalizePrimary(p.primary, panel);
  const lod = UNIVERSE_LODS.includes(p.universeLod) ? p.universeLod : 'vault';
  const viewMode = UNIVERSE_VIEW_MODES.includes(p.universeViewMode) ? p.universeViewMode : 'spatial';
  return {
    primary,
    panel,
    universeLod: lod,
    universeViewMode: viewMode,
    filters: sanitizeFilters(p.filters),
    disclosure: sanitizeDisclosure(p.disclosure)
  };
}

function stripSecretsDeep(value, depth = 0) {
  if (depth > 8 || value == null) return value;
  if (Array.isArray(value)) return value.map(v => stripSecretsDeep(v, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SECRET_KEYS.some(s => k.toLowerCase().includes(s.toLowerCase()))) continue;
    out[k] = stripSecretsDeep(v, depth + 1);
  }
  return out;
}

/**
 * Serialize one Saved View. Rejects payloads that try to freeze HEADs/secrets as truth.
 */
export function serializeSavedView(input = {}, { now = () => new Date().toISOString(), idFactory } = {}) {
  const name = asTrimmed(input.name).slice(0, 80);
  if (!name) throw new Error('Saved View name is required');

  const scopeSelector = sanitizeScopeSelector(input.scopeSelector || input.scope);
  const presentation = sanitizePresentation(input.presentation || {});
  const freshnessHint = sanitizeFreshnessHint(input.freshnessHint || input.presentation?.freshnessHint);
  const id = asTrimmed(input.id) || (typeof idFactory === 'function'
    ? idFactory()
    : `sv:${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now())}`);
  const ts = now();

  const view = stripSecretsDeep({
    schema: SAVED_VIEWS_SCHEMA,
    version: SAVED_VIEWS_VERSION,
    id,
    name,
    created_at: asTrimmed(input.created_at) || ts,
    updated_at: ts,
    scopeSelector,
    presentation,
    freshnessHint,
    note: 'Selectors + presentation only. Opening re-resolves Scope. Not accepted project authority.'
  });

  assertNoAuthorityFreeze(view);
  return view;
}

export function assertNoAuthorityFreeze(view) {
  const json = JSON.stringify(view || {});
  const banned = [
    '"head_hash"', '"path_heads"', '"operator_token"', '"workspace_capability"',
    '"accepted_state_authority":true'
  ];
  for (const b of banned) {
    if (json.includes(b)) {
      throw new Error(`Saved View must not freeze authority/secrets (${b})`);
    }
  }
  return true;
}

/**
 * Parse / normalize a stored Saved View. Invalid entries return null.
 */
export function parseSavedView(raw) {
  try {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.schema && raw.schema !== SAVED_VIEWS_SCHEMA) return null;
    const name = asTrimmed(raw.name);
    if (!name) return null;
    const view = serializeSavedView({
      id: raw.id,
      name,
      created_at: raw.created_at,
      scopeSelector: raw.scopeSelector || raw.scope,
      presentation: raw.presentation,
      freshnessHint: raw.freshnessHint
    });
    return view;
  } catch {
    return null;
  }
}

export function loadSavedViewsStore(storage = localStorage) {
  try {
    const raw = JSON.parse(storage.getItem(SAVED_VIEWS_STORE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') {
      return emptyStore();
    }
    const views = (Array.isArray(raw.views) ? raw.views : [])
      .map(parseSavedView)
      .filter(Boolean)
      .slice(0, 40);
    return {
      schema: SAVED_VIEWS_SCHEMA,
      version: SAVED_VIEWS_VERSION,
      updated_at: raw.updated_at || null,
      note: 'Browser-local Saved Views. Presentation only — never accepted project truth.',
      views
    };
  } catch {
    return emptyStore();
  }
}

function emptyStore() {
  return {
    schema: SAVED_VIEWS_SCHEMA,
    version: SAVED_VIEWS_VERSION,
    updated_at: null,
    note: 'Browser-local Saved Views. Presentation only — never accepted project truth.',
    views: []
  };
}

export function saveSavedViewsStore(store, storage = localStorage) {
  const views = (store?.views || []).map(parseSavedView).filter(Boolean).slice(0, 40);
  const payload = {
    schema: SAVED_VIEWS_SCHEMA,
    version: SAVED_VIEWS_VERSION,
    updated_at: new Date().toISOString(),
    note: 'Browser-local Saved Views. Presentation only — never accepted project truth. No secrets.',
    views
  };
  assertNoAuthorityFreeze(payload);
  storage.setItem(SAVED_VIEWS_STORE_KEY, JSON.stringify(payload));
  return payload;
}

export function upsertSavedView(viewInput, storage = localStorage, opts = {}) {
  const store = loadSavedViewsStore(storage);
  const next = serializeSavedView(viewInput, opts);
  const idx = store.views.findIndex(v => v.id === next.id || v.name === next.name);
  if (idx >= 0) {
    next.id = store.views[idx].id;
    next.created_at = store.views[idx].created_at;
    store.views[idx] = next;
  } else {
    store.views.unshift(next);
  }
  saveSavedViewsStore(store, storage);
  return next;
}

export function deleteSavedView(id, storage = localStorage) {
  const store = loadSavedViewsStore(storage);
  const before = store.views.length;
  store.views = store.views.filter(v => v.id !== id);
  saveSavedViewsStore(store, storage);
  return before !== store.views.length;
}

/**
 * Build an open plan: presentation apply + Scope re-resolve hooks.
 * Does not call MCP itself — caller supplies resolveScope(selector).
 */
export function buildOpenPlan(view) {
  const parsed = parseSavedView(view);
  if (!parsed) {
    return {
      ok: false,
      error: 'Invalid Saved View',
      acceptedStateAuthority: false,
      mustResolveScope: true
    };
  }
  return {
    ok: true,
    view: parsed,
    panel: parsed.presentation.panel,
    primary: parsed.presentation.primary,
    scopeSelector: parsed.scopeSelector,
    universeLod: parsed.presentation.universeLod,
    universeViewMode: parsed.presentation.universeViewMode,
    filters: parsed.presentation.filters,
    disclosure: parsed.presentation.disclosure,
    freshnessHint: parsed.freshnessHint,
    mustResolveScope: true,
    acceptedStateAuthority: false,
    note: 'Apply presentation, then re-resolve Scope. Saved View is not accepted-state.'
  };
}

/**
 * Apply open plan with mocked/real hooks. Authority always re-resolved.
 */
export async function openSavedView(view, hooks = {}) {
  const plan = buildOpenPlan(view);
  if (!plan.ok) {
    if (typeof hooks.onError === 'function') hooks.onError(new Error(plan.error));
    return { ok: false, error: plan.error, acceptedStateAuthority: false };
  }

  const applyPresentation = hooks.applyPresentation || (() => {});
  const resolveScope = hooks.resolveScope;
  const onFreshness = hooks.onFreshness || (() => {});
  const onError = hooks.onError || (() => {});

  try {
    applyPresentation({
      primary: plan.primary,
      panel: plan.panel,
      universeLod: plan.universeLod,
      universeViewMode: plan.universeViewMode,
      filters: plan.filters,
      disclosure: plan.disclosure
    });

    if (typeof resolveScope !== 'function') {
      throw new Error('openSavedView requires resolveScope hook (fresh authority)');
    }

    const snapshot = await resolveScope(plan.scopeSelector);
    const freshness = compareFreshness(plan.freshnessHint, snapshot);
    onFreshness(freshness);

    return {
      ok: true,
      plan,
      snapshot: snapshot || null,
      freshness,
      acceptedStateAuthority: false,
      note: 'Scope re-resolved on open. Saved View did not freeze HEADs.'
    };
  } catch (err) {
    onError(err);
    return {
      ok: false,
      plan,
      error: String(err?.message || err || 'Open failed'),
      acceptedStateAuthority: false
    };
  }
}

export function compareFreshness(hint, snapshot) {
  const currentDigest = asTrimmed(snapshot?.authority_digest);
  const currentScopeId = asTrimmed(snapshot?.scope_id);
  const priorDigest = asTrimmed(hint?.authority_digest);
  const priorScopeId = asTrimmed(hint?.scope_id);

  if (!snapshot) {
    return {
      status: 'unresolved',
      message: 'Scope could not be resolved. Saved View is not accepted-state.',
      headsMayHaveMoved: null,
      acceptedStateAuthority: false
    };
  }

  if (!priorDigest && !priorScopeId) {
    return {
      status: 'resolved_fresh',
      message: 'Scope re-resolved from selectors. No prior digest was stored — Saved Views never freeze authority.',
      headsMayHaveMoved: null,
      currentDigest: currentDigest || null,
      currentScopeId: currentScopeId || null,
      acceptedStateAuthority: false
    };
  }

  const digestChanged = priorDigest && currentDigest && priorDigest !== currentDigest;
  const scopeChanged = priorScopeId && currentScopeId && priorScopeId !== currentScopeId;
  const moved = Boolean(digestChanged || scopeChanged);

  return {
    status: moved ? 'heads_may_have_moved' : 'matches_prior_hint',
    message: moved
      ? 'Authority digest changed since this view was saved. Showing freshly resolved Scope — Saved View is not accepted-state.'
      : 'Fresh resolve matches the presentation hint. Still not treated as frozen accepted truth.',
    headsMayHaveMoved: moved,
    priorDigest: priorDigest || null,
    currentDigest: currentDigest || null,
    currentScopeId: currentScopeId || null,
    acceptedStateAuthority: false
  };
}

/**
 * Capture current console presentation + Scope selectors for "Save view".
 */
export function captureCurrentView({
  name,
  scope,
  primary,
  panel,
  universeLod,
  universeViewMode,
  filters,
  disclosure,
  scopeSnapshot,
  id
} = {}) {
  return serializeSavedView({
    id,
    name,
    scopeSelector: scope,
    presentation: {
      primary,
      panel,
      universeLod,
      universeViewMode,
      filters,
      disclosure
    },
    freshnessHint: scopeSnapshot ? {
      authority_digest: scopeSnapshot.authority_digest || null,
      scope_id: scopeSnapshot.scope_id || null
    } : null
  });
}

export function listSavedViewSummaries(storage = localStorage) {
  return loadSavedViewsStore(storage).views.map(v => ({
    id: v.id,
    name: v.name,
    primary: v.presentation.primary,
    panel: v.presentation.panel,
    scopeMode: v.scopeSelector.mode,
    updated_at: v.updated_at
  }));
}
