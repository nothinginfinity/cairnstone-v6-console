/**
 * V7.7.9c — Communications hub helpers (Inbox · Handoff · Activity).
 * Presentation consolidation only. Preserves AC1 immutable message identity,
 * evidence-based Scope association, and zero execution authority from correspondence.
 */

export const COMMS_SURFACES = Object.freeze({
  inbox: {
    id: 'inbox',
    label: 'Inbox',
    intent: 'Read correspondence',
    eyebrow: 'AC1 correspondence',
    blurb: 'Read immutable messages for one recipient. Reading may update delivery status only; the message stone stays immutable. Correspondence grants no execution authority.',
    scopeNote: 'Inbox is not auto-filtered by Scope: compact AC1 inbox metadata does not carry an authoritative chain association.'
  },
  handoff: {
    id: 'handoff',
    label: 'Handoff',
    intent: 'Dispatch structured handoff',
    eyebrow: 'Structured AC1 dispatch',
    blurb: 'Creates immutable correspondence that transports intent and provenance. It grants no execution, mutation, or accepted-state authority.',
    scopeNote: 'Handoff association is explicit: choose one exact participating chain from the current Scope (AC1 carries one chain field).'
  },
  activity: {
    id: 'activity',
    label: 'Activity',
    intent: 'Cross-actor activity',
    eyebrow: 'Combined AC1 view',
    blurb: 'Aggregated recent correspondence across actor inboxes you query. Same AC1 stones — presentation grouping only.',
    scopeNote: 'Activity is not silently filtered by global Scope; compact listing metadata does not expose a trustworthy chain field.'
  }
});

export function commsSurfaceMeta(panel) {
  return COMMS_SURFACES[panel] || COMMS_SURFACES.inbox;
}

/** Hub banner copy for the active communications surface. */
export function commsHubBanner(panel) {
  const meta = commsSurfaceMeta(panel);
  return {
    panel: meta.id,
    label: meta.label,
    intent: meta.intent,
    eyebrow: meta.eyebrow,
    blurb: meta.blurb,
    scopeNote: meta.scopeNote,
    grantsExecutionAuthority: false,
    acceptedStateAuthority: false,
    identityNote: 'Message identity remains the immutable AC1 stone_hash / message_id from the runtime.'
  };
}

/** Subnav items for the Inbox primary (presentation labels). */
export function commsSubnavItems() {
  return Object.values(COMMS_SURFACES).map(s => ({
    panel: s.id,
    label: s.label,
    intent: s.intent,
    title: `${s.label} — ${s.intent}`
  }));
}

/**
 * Normalize an AC1 listing row for shared list/thread UI.
 * Does not invent chain/Scope ownership from subject or actor names.
 */
export function normalizeMessageRow(m, { surface = 'inbox' } = {}) {
  const intent = String(m?.intent || 'message').toLowerCase();
  const status = String(m?.status || '').toLowerCase();
  const unread = status !== 'read' && status !== '';
  return {
    message_id: m?.message_id || null,
    stone_hash: m?.stone_hash || null,
    thread_id: m?.thread_id || null,
    subject: m?.subject || '(no subject)',
    sender_id: m?.sender_id || 'unknown',
    recipient_id: m?.for || m?.recipient_id || null,
    intent,
    intentLabel: intentLabel(intent),
    priority: m?.priority || 'normal',
    status: m?.status || '',
    unread,
    created_at: m?.created_at || null,
    surface,
    // Explicit: no inferred Scope/chain from listing metadata
    scopeAssociated: false,
    grantsExecutionAuthority: false
  };
}

export function intentLabel(intent) {
  const i = String(intent || 'message').toLowerCase();
  if (i === 'handoff') return 'Handoff';
  if (i === 'task_request' || i === 'task-request') return 'Task request';
  if (i === 'task_result' || i === 'task-result') return 'Task result';
  if (i === 'invite' || i === 'workspace_invite') return 'Invite';
  if (i === 'message') return 'Message';
  return i || 'Message';
}

export function filterActivityItems(items, filter = 'all') {
  const list = Array.isArray(items) ? items.slice() : [];
  if (filter === 'handoff') return list.filter(m => String(m.intent || '').toLowerCase() === 'handoff');
  if (filter === 'message') return list.filter(m => String(m.intent || '').toLowerCase() !== 'handoff');
  return list;
}

export function sortMessagesNewestFirst(items) {
  return (Array.isArray(items) ? items.slice() : []).sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
}

/**
 * Group by thread_id for shared thread list pattern.
 * Threads without an id land under "(no thread)".
 */
export function groupMessagesByThread(items) {
  const groups = new Map();
  for (const m of items || []) {
    const key = m.thread_id || '(no thread)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  return [...groups.entries()].map(([thread_id, messages]) => ({
    thread_id,
    count: messages.length,
    messages
  }));
}

/**
 * Shared list empty/loading/error copy — no fake capabilities.
 */
export function commsListState({ loading = false, error = null, count = 0, surface = 'inbox' } = {}) {
  const meta = commsSurfaceMeta(surface);
  if (loading) {
    return { status: 'loading', message: `Loading ${meta.label.toLowerCase()}…` };
  }
  if (error) {
    return { status: 'error', message: String(error.message || error) };
  }
  if (!count) {
    return {
      status: 'empty',
      message: surface === 'handoff'
        ? 'No handoff dispatched yet from this surface.'
        : `No ${meta.label.toLowerCase()} items. Refresh to load AC1 correspondence.`
    };
  }
  return { status: 'ready', message: `${count} item${count === 1 ? '' : 's'}` };
}

/** Whether a handoff chain is an exact participating Scope chain (evidence-based). */
export function handoffChainAllowed(chain, scopeChains = []) {
  const c = String(chain || '').trim();
  if (!c) return false;
  return (scopeChains || []).some(x => (x.chain || x) === c);
}
