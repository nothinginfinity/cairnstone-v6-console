/**
 * V7.7.10f — Worker event-plane poll helpers.
 */

export const EVENT_LIST_TOOL = 'cairnstone_event_list';
export const AGENT_TREE_TOOL = 'cairnstone_agent_tree';
export const EVENT_SCHEMA = 'cairnstone-event-v1';
export const TREE_SCHEMA = 'cairnstone-agent-tree-v1';

const EVENT_LIST_ARG_KEYS = Object.freeze(['actor_id', 'task_run_id', 'status', 'since', 'limit']);
const AGENT_TREE_ARG_KEYS = Object.freeze(['actor_id', 'root_task_run_id', 'limit']);

function pickAllowedArgs(keys, source = {}) {
  const src = source && typeof source === 'object' ? source : {};
  const out = {};
  for (const key of keys) {
    const value = src[key];
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
}

function cleanText(value) {
  const text = String(value || '').trim();
  return text || undefined;
}

function cleanLimit(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

function normalizeEvents(result = {}) {
  const rows = Array.isArray(result.events)
    ? result.events
    : Array.isArray(result.items)
      ? result.items
      : Array.isArray(result.result?.events)
        ? result.result.events
        : [];
  return rows.map((row) => ({
    event_type: String(row?.event_type || row?.type || 'unknown').trim() || 'unknown',
    task_run_id: String(row?.task_run_id || row?.task_run?.task_run_id || row?.root_task_run_id || '').trim() || '—',
    status: String(row?.status || row?.task_status || '—').trim() || '—',
    dispatch_state: String(row?.dispatch_state || row?.dispatch?.state || '—').trim() || '—'
  }));
}

function rawRoots(result = {}) {
  if (Array.isArray(result.roots)) return result.roots;
  if (Array.isArray(result.tree?.roots)) return result.tree.roots;
  if (result.root && typeof result.root === 'object') return [result.root];
  return [];
}

function normalizeNode(node, depth = 0) {
  const children = Array.isArray(node?.children) ? node.children : [];
  return {
    task_run_id: String(node?.task_run_id || node?.id || node?.task_run?.task_run_id || '').trim() || '—',
    status: String(node?.status || node?.task_run?.status || '—').trim() || '—',
    dispatch_state: String(node?.dispatch_state || node?.dispatch?.state || '—').trim() || '—',
    depth,
    children: children.map(child => normalizeNode(child, depth + 1))
  };
}

function normalizeRoots(result = {}) {
  return rawRoots(result).map(root => normalizeNode(root, 0));
}

function flattenTree(nodes = [], lines = []) {
  for (const node of nodes) {
    lines.push(`Depth ${node.depth}: ${node.task_run_id} · status ${node.status} · dispatch ${node.dispatch_state}`);
    flattenTree(node.children, lines);
  }
  return lines;
}

function unavailableCard(tool, schema) {
  return {
    ok: false,
    error: 'tool_unavailable',
    tool,
    schema,
    title: 'Worker tool unavailable',
    lines: [
      `Tool: ${tool}`,
      `Schema: ${schema}`,
      'Transport: poll only',
      'Accepted-state authority: false'
    ],
    accepted_state_authority: false,
    honesty: 'Worker 10f tools not on this runtime. Poll stays blocked. Presentation never invents events or moves HEADs.'
  };
}

export function buildEventListArgs({ actor_id, task_run_id, status, since, limit } = {}) {
  return pickAllowedArgs(EVENT_LIST_ARG_KEYS, {
    actor_id: cleanText(actor_id),
    task_run_id: cleanText(task_run_id),
    status: cleanText(status),
    since: cleanText(since),
    limit: cleanLimit(limit)
  });
}

export function buildAgentTreeArgs({ actor_id, root_task_run_id, limit } = {}) {
  return pickAllowedArgs(AGENT_TREE_ARG_KEYS, {
    actor_id: cleanText(actor_id),
    root_task_run_id: cleanText(root_task_run_id),
    limit: cleanLimit(limit)
  });
}

export function compileEventListCard(result = {}, { toolsAvailable } = {}) {
  if (!toolsAvailable) return unavailableCard(EVENT_LIST_TOOL, EVENT_SCHEMA);
  const events = normalizeEvents(result);
  const lines = [
    `Tool: ${EVENT_LIST_TOOL}`,
    `Schema: ${EVENT_SCHEMA}`,
    'Transport: poll only',
    'Accepted-state authority: false'
  ];
  if (events.length) {
    for (const row of events) {
      lines.push(`${row.event_type} · ${row.task_run_id} · ${row.status} · ${row.dispatch_state}`);
    }
  } else if (result?.ok === false) {
    lines.push(`Blocked: ${result.error || 'Worker event query failed'}`);
  } else {
    lines.push('No events returned.');
  }
  return {
    ok: result?.ok !== false,
    tool: EVENT_LIST_TOOL,
    schema: EVENT_SCHEMA,
    title: events.length ? 'Event poll ready' : result?.ok === false ? 'Event poll blocked' : 'No events',
    events,
    lines,
    error: result?.ok === false ? (result.error || 'worker_error') : null,
    accepted_state_authority: false
  };
}

export function compileAgentTreeCard(result = {}, { toolsAvailable } = {}) {
  if (!toolsAvailable) return unavailableCard(AGENT_TREE_TOOL, TREE_SCHEMA);
  const roots = normalizeRoots(result);
  const lines = [
    `Tool: ${AGENT_TREE_TOOL}`,
    `Schema: ${TREE_SCHEMA}`,
    'Transport: poll only; no live WS',
    'Accepted-state authority: false'
  ];
  if (roots.length) {
    flattenTree(roots, lines);
  } else if (result?.ok === false) {
    lines.push(`Blocked: ${result.error || 'Worker tree query failed'}`);
  } else {
    lines.push('No agent tree rows returned.');
  }
  return {
    ok: result?.ok !== false,
    tool: AGENT_TREE_TOOL,
    schema: TREE_SCHEMA,
    title: roots.length ? 'Agent tree ready' : result?.ok === false ? 'Agent tree blocked' : 'No agent tree',
    roots,
    lines,
    error: result?.ok === false ? (result.error || 'worker_error') : null,
    accepted_state_authority: false
  };
}

export function subscribeHonesty() {
  return {
    ok: false,
    error: 'upgrade_unavailable',
    title: 'Subscribe upgrade unavailable',
    lines: [
      'Transport: poll only; no live WebSocket',
      'Accepted-state authority: false'
    ],
    accepted_state_authority: false,
    honesty: 'Worker 10f subscribe API is not on this runtime. Poll only; no live WebSocket. Presentation never invents events or moves HEADs.'
  };
}

export function summarizeEventCard(card) {
  if (!card) return 'No event-plane result yet.';
  const title = String(card.title || (card.ok ? 'Ready' : 'Blocked')).trim();
  const lines = Array.isArray(card.lines) && card.lines.length
    ? card.lines.slice()
    : [card.honesty, card.error].filter(Boolean);
  if (card.honesty && !lines.includes(card.honesty)) lines.push(card.honesty);
  return [title, ...lines].filter(Boolean).join('\n');
}
