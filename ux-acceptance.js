/**
 * V7.7.9f — Cross-device UX acceptance helpers (presentation only).
 * Reachability map + reduced-motion / authority-boundary invariants for tests + docs.
 */

/** Primary IA destinations (9a). */
export const PRIMARY_IA = Object.freeze(['chat', 'work', 'universe', 'inbox', 'more']);

/**
 * Legacy / secondary capabilities and how they remain reachable after the redesign.
 * Paths are human-readable navigation recipes (not URLs).
 */
export const REACHABILITY_MAP = Object.freeze([
  { capability: 'Chat / Ask', path: 'Primary → Chat', panel: 'chat', primary: 'chat' },
  { capability: 'Answer Depth (response_lod 1→5)', path: 'Primary → Chat → answer depth controls', panel: 'chat', primary: 'chat' },
  { capability: 'Chat config (provider/model)', path: 'Primary → Chat → Chat config sheet', panel: 'chat', primary: 'chat', sheet: 'chatConfigSheet' },
  { capability: 'Evidence (contextual)', path: 'Primary → Chat → Evidence drawer (same response_id)', panel: 'chat', primary: 'chat', sheet: 'evidenceDrawer' },
  { capability: 'Evidence explorer', path: 'Primary → More → Evidence', panel: 'evidence', primary: 'more' },
  { capability: 'Work / Code Session', path: 'Primary → Work', panel: 'code', primary: 'work' },
  { capability: 'Universe v2', path: 'Primary → Universe (+ overlay)', panel: 'universe', primary: 'universe', sheet: 'universeOverlay' },
  { capability: 'Inbox', path: 'Primary → Inbox → Inbox', panel: 'inbox', primary: 'inbox' },
  { capability: 'Message reader (mobile focus)', path: 'Primary → Inbox → message → Message Reader sheet', panel: 'inbox', primary: 'inbox', sheet: 'messageReaderSheet' },
  { capability: 'Handoff', path: 'Primary → Inbox → Handoff', panel: 'handoff', primary: 'inbox' },
  { capability: 'Activity', path: 'Primary → Inbox → Activity', panel: 'activity', primary: 'inbox' },
  { capability: 'Stones', path: 'Primary → More → Stones', panel: 'stones', primary: 'more' },
  { capability: 'Access grants (Give Access / Assign / Forward)', path: 'Primary → More → Access · share sheet from Message Reader / Stones / Evidence / Work', panel: 'access', primary: 'more', sheet: 'shareSheet' },
  { capability: 'Authorize (V7.3)', path: 'Primary → More → Authorize', panel: 'authorize', primary: 'more' },
  { capability: 'Invite / mailbox', path: 'Primary → More → Invite', panel: 'invite', primary: 'more' },
  { capability: 'Runtime MCP + actor', path: 'Context bar → Runtime / Actor sheets · More → Runtime', panel: 'settings', primary: 'more', sheet: 'runtimeSheet' },
  { capability: 'Scope', path: 'Context bar → Scope sheet', panel: null, primary: null, sheet: 'scopeSheet' },
  { capability: 'Saved Views', path: 'Context bar → Views sheet', panel: null, primary: null, sheet: 'savedViewsSheet' }
]);

/** MCP tools that may move accepted-state HEADs — must never be called from presentation/navigation. */
export const HEAD_MUTATION_TOOLS = Object.freeze([
  'cairnstone_set_head',
  'cairnstone_set_path_head'
]);

/** Presentation / navigation MCP tools expected on pure UX paths (read or non-HEAD). */
export const PRESENTATION_SAFE_MCP = Object.freeze([
  'cairnstone_health',
  'cairnstone_vault_catalog',
  'cairnstone_resolve_scope',
  'cairnstone_model_capabilities',
  'cairnstone_grounded_response',
  'cairnstone_grounded_response_get',
  'cairnstone_grounded_response_expand',
  'cairnstone_delegate',
  'cairnstone_get_inbox',
  'cairnstone_read_message',
  'cairnstone_dispatch_handoff',
  'cairnstone_list_stones',
  'cairnstone_find_scope',
  'cairnstone_resume_chain',
  'cairnstone_manifest_v2',
  'cairnstone_code_session_console_view',
  'cairnstone_send_message',
  'cairnstone_workspace_propose_accept',
  'cairnstone_access_grant_create',
  'cairnstone_access_grant_list',
  'cairnstone_access_grant_revoke',
  'cairnstone_attachment_ref_resolve',
  'cairnstone_task_run_propose',
  'cairnstone_forward_with_note'
]);

/**
 * CSS class applied when prefers-reduced-motion is active (optional JS mirror of the media query).
 */
export const REDUCED_MOTION_CLASS = 'cs-reduced-motion';

export function prefersReducedMotion(media = globalThis.matchMedia) {
  if (typeof media !== 'function') return false;
  try {
    return Boolean(media('(prefers-reduced-motion: reduce)')?.matches);
  } catch {
    return false;
  }
}

export function applyReducedMotionClass(root = globalThis.document?.documentElement, media = globalThis.matchMedia) {
  if (!root || !root.classList) return false;
  const on = prefersReducedMotion(media);
  root.classList.toggle(REDUCED_MOTION_CLASS, on);
  return on;
}

export function reachabilityForPrimary(primary) {
  const p = String(primary || '').toLowerCase();
  return REACHABILITY_MAP.filter(row => row.primary === p);
}

export function legacyPanelsReachable() {
  return REACHABILITY_MAP
    .filter(row => row.panel)
    .map(row => row.panel);
}

/**
 * Static authority check: source text must not invoke HEAD mutation tools via mcpCall.
 * Authorize may mention set_head in human-readable material-effect copy only.
 */
export function assertNoPresentationHeadMutation(sourceText) {
  const src = String(sourceText || '');
  const mcpHeadCalls = [];
  for (const tool of HEAD_MUTATION_TOOLS) {
    const re = new RegExp(`mcpCall\\(\\s*['"]${tool}['"]`);
    if (re.test(src)) mcpHeadCalls.push(tool);
  }
  return {
    ok: mcpHeadCalls.length === 0,
    mcpHeadCalls,
    authorizeMentionsHeadTools: /set_head|set_path_head/.test(src),
    note: 'HEAD moves remain V7.3 Authorize (REST /v1/tool-authorizations…), not presentation mcpCall'
  };
}

export function acceptanceViewports() {
  return Object.freeze({
    mobile: { width: 390, height: 844, label: 'iPhone-size (~390×844)' },
    desktop: { width: 1280, height: 800, label: 'Desktop (≥1280)' }
  });
}
