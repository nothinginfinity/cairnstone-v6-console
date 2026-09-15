/**
 * Actor Inbox Navigator — presentation / discovery only.
 *
 * Friendly actor directory shared by Inbox · Handoff · Activity.
 * Derives choices from seeded canonical mailbox conventions + observed AC1
 * sender/recipient IDs. Does not create a competing actor registry or any
 * new server / accepted-state authority.
 *
 * Work suffix stays `:cairnstone-v6` (do not migrate to `:cairnstone-v7`).
 */

export const WORK_SUFFIX = 'cairnstone-v6';
export const CHAT_SUFFIX = 'chat';

export const OBSERVED_STORE_KEY = 'cs.actorNav.observed.v1';
export const INBOX_NAV_STORE_KEY = 'cs.actorNav.inbox.v1';
export const ACTIVITY_NAV_STORE_KEY = 'cs.actorNav.activity.v1';
export const HANDOFF_NAV_STORE_KEY = 'cs.actorNav.handoff.v1';

/** Seeded canonical actors for usability (not an authoritative registry). */
export const SEED_ACTORS = Object.freeze([
  Object.freeze({
    key: 'grok',
    display: 'Grok',
    mailboxes: Object.freeze({ chat: 'grok:chat', work: 'grok:cairnstone-v6' })
  }),
  Object.freeze({
    key: 'claude',
    display: 'Claude',
    mailboxes: Object.freeze({ chat: 'claude:chat', work: 'claude:cairnstone-v6' })
  }),
  Object.freeze({
    key: 'chatgpt',
    display: 'ChatGPT',
    mailboxes: Object.freeze({ chat: 'chatgpt:chat', work: 'chatgpt:cairnstone-v6' })
  }),
  Object.freeze({
    key: 'grok-bot',
    display: 'Grok Bot',
    mailboxes: Object.freeze({ work: 'grok-bot:cairnstone-v6' })
  })
]);

export function actorPickerPrompt(surface = 'inbox') {
  if (surface === 'activity') return 'Whose activity?';
  if (surface === 'handoff') return 'Choose recipients';
  return 'Choose inbox';
}

export function parseMailboxId(id) {
  const raw = String(id || '').trim();
  if (!raw) return null;
  const idx = raw.indexOf(':');
  if (idx <= 0) {
    return { raw, namespace: raw, plane: 'other', suffix: '' };
  }
  const namespace = raw.slice(0, idx);
  const suffix = raw.slice(idx + 1);
  let plane = 'other';
  if (suffix === CHAT_SUFFIX) plane = 'chat';
  else if (suffix === WORK_SUFFIX) plane = 'work';
  return { raw, namespace, plane, suffix };
}

export function displayNameForNamespace(namespace) {
  const ns = String(namespace || '').trim();
  const key = ns.toLowerCase();
  const seed = SEED_ACTORS.find(a => a.key === key);
  if (seed) return seed.display;
  if (!ns) return 'Unknown';
  return ns
    .split(/[-_]/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function mailboxPlaneBadge(mailboxId) {
  const parsed = parseMailboxId(mailboxId);
  if (!parsed) return null;
  if (parsed.plane === 'chat') return { plane: 'chat', label: 'Chat' };
  if (parsed.plane === 'work') return { plane: 'work', label: 'Work' };
  return { plane: 'other', label: 'Custom' };
}

function planesFromMailboxes(mailboxes = {}) {
  const planes = [];
  if (mailboxes.chat) planes.push('chat');
  if (mailboxes.work || (mailboxes.other && mailboxes.other.length)) planes.push('work');
  return planes;
}

function allMailboxIds(mailboxes = {}) {
  return [
    mailboxes.chat,
    mailboxes.work,
    ...(Array.isArray(mailboxes.other) ? mailboxes.other : [])
  ].filter(Boolean);
}

function normalizeEntry(entry) {
  const mailboxes = {
    ...(entry.mailboxes || {})
  };
  if (mailboxes.other && !mailboxes.other.length) delete mailboxes.other;
  const ids = allMailboxIds(mailboxes);
  return {
    key: entry.key,
    display: entry.display,
    mailboxes,
    source: entry.source || 'observed',
    planes: planesFromMailboxes(mailboxes),
    hasBothPlanes: !!(mailboxes.chat && mailboxes.work),
    allMailboxIds: ids,
    exactIds: ids
  };
}

function compareActors(a, b) {
  const seedOrder = SEED_ACTORS.map(s => s.key);
  const ai = seedOrder.indexOf(a.key);
  const bi = seedOrder.indexOf(b.key);
  if (ai >= 0 || bi >= 0) {
    if (ai < 0) return 1;
    if (bi < 0) return -1;
    return ai - bi;
  }
  return String(a.display).localeCompare(String(b.display));
}

/**
 * Build the actor directory from seeds + observed mailbox IDs.
 * Newly observed chat/work IDs get the canonical sibling plane from convention.
 * Unusual suffixes (e.g. console:jared) stay exact — no invented siblings.
 */
export function buildActorDirectory({ observedIds = [], seeds = SEED_ACTORS } = {}) {
  const byKey = new Map();

  for (const seed of seeds) {
    byKey.set(seed.key, {
      key: seed.key,
      display: seed.display,
      mailboxes: { ...seed.mailboxes },
      source: 'seed'
    });
  }

  for (const id of observedIds || []) {
    const parsed = parseMailboxId(id);
    if (!parsed) continue;
    const key = parsed.namespace.toLowerCase();
    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        key,
        display: displayNameForNamespace(parsed.namespace),
        mailboxes: {},
        source: 'observed'
      };
      byKey.set(key, entry);
    }

    if (parsed.plane === 'chat') {
      entry.mailboxes.chat = parsed.raw;
      if (entry.source === 'observed' && !entry.mailboxes.work) {
        entry.mailboxes.work = `${parsed.namespace}:${WORK_SUFFIX}`;
      }
    } else if (parsed.plane === 'work') {
      entry.mailboxes.work = parsed.raw;
      if (entry.source === 'observed' && !entry.mailboxes.chat) {
        entry.mailboxes.chat = `${parsed.namespace}:${CHAT_SUFFIX}`;
      }
    } else {
      entry.mailboxes.other = Array.isArray(entry.mailboxes.other) ? entry.mailboxes.other : [];
      if (!entry.mailboxes.other.includes(parsed.raw)) {
        entry.mailboxes.other.push(parsed.raw);
      }
    }
  }

  return [...byKey.values()].map(normalizeEntry).sort(compareActors);
}

/** Recipient IDs to query for one actor + plane segmentation. */
export function recipientIdsForSelection(actor, plane = 'all') {
  if (!actor) return [];
  const m = actor.mailboxes || {};
  if (plane === 'chat') return m.chat ? [m.chat] : [];
  if (plane === 'work') {
    const ids = [];
    if (m.work) ids.push(m.work);
    if (Array.isArray(m.other)) ids.push(...m.other);
    return ids;
  }
  return actor.allMailboxIds ? actor.allMailboxIds.slice() : allMailboxIds(m);
}

/** Prefer work mailbox for handoff recipients; fall back to custom / chat. */
export function defaultHandoffRecipients(actor) {
  if (!actor) return [];
  const m = actor.mailboxes || {};
  if (m.work) return [m.work];
  if (Array.isArray(m.other) && m.other.length) return m.other.slice();
  if (m.chat) return [m.chat];
  return actor.allMailboxIds ? actor.allMailboxIds.slice() : [];
}

export function planesAvailable(actor) {
  if (!actor) return ['all'];
  const planes = ['all'];
  if (actor.mailboxes?.chat) planes.push('chat');
  if (actor.mailboxes?.work || (actor.mailboxes?.other && actor.mailboxes.other.length)) {
    planes.push('work');
  }
  return planes;
}

export function filterMessagesByPlane(messages, plane = 'all') {
  const list = Array.isArray(messages) ? messages.slice() : [];
  if (!plane || plane === 'all') return list;
  return list.filter(m => {
    const id = m.for || m.recipient_id || m.mailbox_id;
    const p = parseMailboxId(id)?.plane || 'other';
    if (plane === 'work') return p === 'work' || p === 'other';
    return p === plane;
  });
}

export function collectObservedIdsFromMessages(messages = []) {
  const ids = new Set();
  for (const m of messages || []) {
    for (const key of ['sender_id', 'for', 'recipient_id', 'from']) {
      const v = m?.[key];
      if (v) ids.add(String(v).trim());
    }
  }
  return [...ids].filter(Boolean);
}

export function mergeObservedIds(existing = [], next = []) {
  return [...new Set(
    [...(existing || []), ...(next || [])]
      .map(s => String(s || '').trim())
      .filter(Boolean)
  )].sort();
}

export function loadObservedIds(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(OBSERVED_STORE_KEY);
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

export function saveObservedIds(ids, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(OBSERVED_STORE_KEY, JSON.stringify(mergeObservedIds([], ids)));
  } catch {
    /* ignore quota / private mode */
  }
}

export function summarizeMailboxStats(messagesByMailbox = {}) {
  let unread = 0;
  let total = 0;
  let latest = null;
  const planeUnread = { chat: 0, work: 0, other: 0 };
  for (const [mailbox, msgs] of Object.entries(messagesByMailbox || {})) {
    const plane = parseMailboxId(mailbox)?.plane || 'other';
    for (const m of msgs || []) {
      total += 1;
      const status = String(m.status || '').toLowerCase();
      const isUnread = status !== 'read' && status !== '';
      if (isUnread) {
        unread += 1;
        planeUnread[plane] = (planeUnread[plane] || 0) + 1;
      }
      const ts = m.created_at ? new Date(m.created_at).getTime() : 0;
      if (!latest || ts > (latest.ts || 0)) {
        latest = {
          ts,
          at: m.created_at || null,
          subject: m.subject || '(no subject)',
          mailbox
        };
      }
    }
  }
  return { unread, total, latest, planeUnread };
}

export function summarizeActorFromMessages(messages = []) {
  const byMailbox = {};
  for (const m of messages || []) {
    const box = m.for || m.recipient_id || m.mailbox_id || '_';
    if (!byMailbox[box]) byMailbox[box] = [];
    byMailbox[box].push(m);
  }
  return summarizeMailboxStats(byMailbox);
}

/** Resolve selection persistence for Inbox (single actor + plane). */
export function normalizeInboxSelection(raw, directory = []) {
  const dir = Array.isArray(directory) ? directory : [];
  const keys = new Set(dir.map(a => a.key));
  let actorKey = String(raw?.actorKey || '').trim();
  let plane = String(raw?.plane || 'all').trim().toLowerCase();
  if (!keys.has(actorKey)) {
    actorKey = dir.find(a => a.key === 'claude')?.key
      || dir[0]?.key
      || '';
  }
  const actor = dir.find(a => a.key === actorKey) || null;
  const allowed = planesAvailable(actor);
  if (!allowed.includes(plane)) plane = 'all';
  return { actorKey, plane };
}

/** Multi-select actor keys for Activity / Handoff. */
export function normalizeMultiSelection(rawKeys, directory = [], { fallbackKeys = [] } = {}) {
  const dir = Array.isArray(directory) ? directory : [];
  const keys = new Set(dir.map(a => a.key));
  let selected = [...new Set((rawKeys || []).map(k => String(k || '').trim()).filter(k => keys.has(k)))];
  if (!selected.length) {
    selected = (fallbackKeys || []).map(k => String(k || '').trim()).filter(k => keys.has(k));
  }
  if (!selected.length && dir.length) {
    // Prefer seeded work actors for activity defaults
    const preferred = ['claude', 'grok', 'chatgpt', 'grok-bot'].filter(k => keys.has(k));
    selected = preferred.length ? preferred.slice(0, 2) : [dir[0].key];
  }
  return selected;
}

export function loadJsonStore(key, storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage?.getItem?.(key) || 'null');
  } catch {
    return null;
  }
}

export function saveJsonStore(key, value, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

/**
 * Parse legacy comma-separated actor ID fields into observed IDs + best-effort keys.
 */
export function parseLegacyActorField(value) {
  const ids = String(value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const keys = [];
  for (const id of ids) {
    const parsed = parseMailboxId(id);
    if (parsed?.namespace) keys.push(parsed.namespace.toLowerCase());
  }
  return { ids, keys: [...new Set(keys)] };
}

/**
 * HTML for one actor chip/card in the picker (string; app escapes via esc()).
 * Stats optional: { unread, total, latest }.
 */
export function actorCardModel(actor, { selected = false, stats = null, mode = 'single' } = {}) {
  const badges = [];
  if (actor.mailboxes?.chat) badges.push({ plane: 'chat', label: 'Chat' });
  if (actor.mailboxes?.work) badges.push({ plane: 'work', label: 'Work' });
  if (actor.mailboxes?.other?.length) badges.push({ plane: 'other', label: 'Custom' });

  let recent = '';
  if (stats?.latest?.subject) {
    recent = String(stats.latest.subject);
  }

  return {
    key: actor.key,
    display: actor.display,
    selected: !!selected,
    mode,
    badges,
    unread: Number(stats?.unread || 0),
    total: Number(stats?.total || 0),
    recent,
    exactIds: actor.exactIds || actor.allMailboxIds || [],
    source: actor.source
  };
}
