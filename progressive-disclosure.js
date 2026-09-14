/**
 * V7.7.9e — Progressive disclosure models (presentation only).
 * First paint stays task-oriented; advanced/raw controls collapse behind clear steps.
 * Empty / loading / error / disabled remain explicit. Never invents accepted-state authority.
 */

/** Scope sheet: compact identity first; browse + diagnostics expand on demand. */
export function scopeDisclosureModel({
  resolved = false,
  loading = false,
  error = null,
  summary = '',
  authorityLine = '',
  diagnostics = '',
  pickerOpen = false,
  advancedOpen = false
} = {}) {
  if (loading) {
    return {
      status: 'loading',
      title: 'Resolving Scope…',
      body: 'Reading exact participating chain HEAD snapshot via cairnstone_resolve_scope.',
      steps: [{ id: 'identity', title: 'Scope identity', open: true, primary: true }],
      acceptedStateAuthority: false
    };
  }
  if (error) {
    return {
      status: 'error',
      title: 'Scope unavailable',
      body: String(error.message || error),
      steps: [{ id: 'identity', title: 'Scope identity', open: true, primary: true }],
      acceptedStateAuthority: false
    };
  }
  if (!resolved) {
    return {
      status: 'empty',
      title: 'Scope not resolved',
      body: 'Choose a selector, then resolve. Scope is navigation/retrieval context — never a synthetic global HEAD.',
      steps: [
        { id: 'identity', title: 'Scope identity', open: true, primary: true },
        { id: 'browse', title: 'Browse repositories and chains', open: Boolean(pickerOpen), primary: false },
        { id: 'advanced', title: 'Coverage / diagnostics', open: Boolean(advancedOpen), primary: false }
      ],
      acceptedStateAuthority: false
    };
  }
  return {
    status: 'ready',
    title: summary || 'Scope resolved',
    body: authorityLine || 'Fresh authority snapshot from worker.',
    diagnostics: diagnostics || '',
    steps: [
      { id: 'identity', title: 'Scope identity', open: true, primary: true },
      { id: 'browse', title: 'Browse repositories and chains', open: Boolean(pickerOpen), primary: false },
      { id: 'advanced', title: 'Coverage / diagnostics', open: Boolean(advancedOpen), primary: false }
    ],
    acceptedStateAuthority: false
  };
}

/** Stones: browse/search first; detail + raw LOD expand when selected. */
export function stonesDisclosureModel({
  loading = false,
  error = null,
  itemCount = 0,
  selected = false,
  detailOpen = true,
  rawOpen = false,
  query = ''
} = {}) {
  if (loading) {
    return {
      status: 'loading',
      title: 'Loading stones…',
      body: 'Querying current Scope. Console does not invent stone identity.',
      steps: [{ id: 'browse', title: 'Browse / search', open: true, primary: true }],
      acceptedStateAuthority: false
    };
  }
  if (error) {
    return {
      status: 'error',
      title: 'Stones unavailable',
      body: String(error.message || error),
      steps: [{ id: 'browse', title: 'Browse / search', open: true, primary: true }],
      acceptedStateAuthority: false
    };
  }
  if (!itemCount && !selected) {
    return {
      status: 'empty',
      title: query ? 'No matches' : 'No stones loaded',
      body: query
        ? 'No stones or matches for this query in the current Scope.'
        : 'Refresh to browse the current Scope. Title / currentness first; LOD and raw expand on demand.',
      steps: [
        { id: 'browse', title: 'Browse / search', open: true, primary: true },
        { id: 'detail', title: 'Summary / preview', open: false, primary: false },
        { id: 'raw', title: 'Raw LOD / refs', open: false, primary: false }
      ],
      acceptedStateAuthority: false
    };
  }
  return {
    status: 'ready',
    title: selected ? 'Stone selected' : `${itemCount} item${itemCount === 1 ? '' : 's'}`,
    body: 'Presentation of Scope-aware stones. HEADs shown are worker-reported; Console does not move them.',
    steps: [
      { id: 'browse', title: 'Browse / search', open: true, primary: true },
      { id: 'detail', title: 'Summary / preview', open: selected ? Boolean(detailOpen) : false, primary: false },
      { id: 'raw', title: 'Raw LOD / refs', open: selected ? Boolean(rawOpen) : false, primary: false }
    ],
    acceptedStateAuthority: false
  };
}

/**
 * Evidence (independent More panel + drawer alignment).
 * Summary/freshness first; skills / memory / observability secondary.
 */
export function evidenceDisclosureModel({
  hasResult = false,
  loading = false,
  error = null,
  sectionsOpen = null
} = {}) {
  const open = new Set(Array.isArray(sectionsOpen) ? sectionsOpen : ['accepted']);
  if (loading) {
    return {
      status: 'loading',
      title: 'Loading evidence…',
      body: 'Bound to response_id / Scope snapshot when available.',
      steps: [{ id: 'summary', title: 'Authority summary', open: true, primary: true }],
      acceptedStateAuthority: false
    };
  }
  if (error) {
    return {
      status: 'error',
      title: 'Evidence unavailable',
      body: String(error.message || error),
      steps: [{ id: 'summary', title: 'Authority summary', open: true, primary: true }],
      acceptedStateAuthority: false
    };
  }
  if (!hasResult) {
    return {
      status: 'empty',
      title: 'No evidence payload yet',
      body: 'Ask in Chat or resolve Scope to inspect citations, claims, and freshness. response_lod ≠ stone_lod.',
      steps: [
        { id: 'summary', title: 'Authority summary', open: true, primary: true },
        { id: 'accepted', title: 'Accepted / cited evidence', open: false, primary: false },
        { id: 'skills', title: 'Selected skills', open: false, primary: false },
        { id: 'memory', title: 'Memory refs', open: false, primary: false },
        { id: 'observability', title: 'Observability / coverage', open: false, primary: false }
      ],
      acceptedStateAuthority: false
    };
  }
  return {
    status: 'ready',
    title: 'Evidence ready',
    body: 'Independent inspection of the latest grounded result / Scope snapshot. Presentation only.',
    steps: [
      { id: 'summary', title: 'Authority summary', open: true, primary: true },
      { id: 'accepted', title: 'Accepted / cited evidence', open: open.has('accepted'), primary: false },
      { id: 'skills', title: 'Selected skills', open: open.has('skills'), primary: false },
      { id: 'memory', title: 'Memory refs', open: open.has('memory'), primary: false },
      { id: 'observability', title: 'Observability / coverage', open: open.has('observability'), primary: false }
    ],
    namingNote: 'response_lod (1→5) is Answer Depth; stone_lod remains storage LOD.',
    acceptedStateAuthority: false
  };
}

/**
 * Authorize: human-readable material effect first; exact args / provenance drill-down.
 * Operator token stays session-only — never part of Saved Views.
 */
export function authorizeDisclosureModel({
  loading = false,
  error = null,
  count = 0,
  selected = false,
  pending = false,
  tokenPresent = false,
  argsOpen = true,
  rawOpen = false,
  materialEffect = ''
} = {}) {
  if (!tokenPresent && !count && !selected) {
    return {
      status: 'disabled',
      title: 'Operator token required',
      body: 'Enter the operator bearer (sessionStorage only), then refresh. Token is never stoned or saved in Saved Views.',
      steps: [
        { id: 'token', title: 'Operator session', open: true, primary: true },
        { id: 'list', title: 'Authorization history', open: true, primary: true }
      ],
      decisionsEnabled: false,
      acceptedStateAuthority: false
    };
  }
  if (loading) {
    return {
      status: 'loading',
      title: 'Loading authorizations…',
      body: 'REST operator surface — outside the model-callable MCP tool catalog.',
      steps: [{ id: 'list', title: 'Authorization history', open: true, primary: true }],
      decisionsEnabled: false,
      acceptedStateAuthority: false
    };
  }
  if (error) {
    return {
      status: 'error',
      title: 'Authorize unavailable',
      body: String(error.message || error),
      steps: [{ id: 'list', title: 'Authorization history', open: true, primary: true }],
      decisionsEnabled: false,
      acceptedStateAuthority: false
    };
  }
  if (!count && !selected) {
    return {
      status: 'empty',
      title: 'No authorization history',
      body: 'Refresh after entering the operator token. Material effect shows first; exact args stay one drill-down away.',
      steps: [
        { id: 'list', title: 'Authorization history', open: true, primary: true },
        { id: 'effect', title: 'Material effect', open: false, primary: false },
        { id: 'args', title: 'Exact stored arguments', open: false, primary: false },
        { id: 'raw', title: 'Immutable request / provenance', open: false, primary: false }
      ],
      decisionsEnabled: false,
      acceptedStateAuthority: false
    };
  }
  return {
    status: 'ready',
    title: selected ? 'Request selected' : `${count} record${count === 1 ? '' : 's'}`,
    body: selected
      ? (materialEffect || 'Review material effect, then expand exact arguments if needed.')
      : 'Select a request. Approve binds to immutable request Stone + argument digest + concurrency guard.',
    steps: [
      { id: 'list', title: 'Authorization history', open: true, primary: true },
      { id: 'effect', title: 'Material effect', open: selected, primary: true },
      { id: 'args', title: 'Exact stored arguments', open: selected && Boolean(argsOpen), primary: false },
      { id: 'raw', title: 'Immutable request / provenance', open: selected && Boolean(rawOpen), primary: false }
    ],
    decisionsEnabled: Boolean(selected && pending),
    acceptedStateAuthority: false
  };
}

/** Work disclosure prefs for Saved Views (open section ids only). */
export function workDisclosurePrefsFromDom(detailsRoot) {
  if (!detailsRoot) return [];
  const open = [];
  detailsRoot.querySelectorAll('details.work-details[data-section]').forEach(el => {
    if (el.open && el.dataset.section) open.push(el.dataset.section);
  });
  return open;
}

export function applyWorkDisclosurePrefs(detailsRoot, openIds = []) {
  if (!detailsRoot) return;
  const want = new Set(openIds || []);
  detailsRoot.querySelectorAll('details.work-details[data-section]').forEach(el => {
    if (el.dataset.section) el.open = want.has(el.dataset.section);
  });
}
