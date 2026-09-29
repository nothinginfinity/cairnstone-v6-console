/**
 * V7.7.10j — Unified Conversation Sync / TurnSync helpers.
 * Operational conversation history only. Never promotes turns to accepted project state.
 */

export const TURN_SYNC_MODES = Object.freeze(['on', 'off', 'ask']);
export const TURN_SYNC_PAYLOADS = Object.freeze(['full_turns', 'decisions_tasks', 'summaries']);
export const TURN_ROLES = Object.freeze(['user', 'assistant', 'system', 'tool', 'operational']);

const uniq = values => [...new Set((values || []).filter(Boolean).map(String))];
const text = value => String(value ?? '').trim();
const list = value => Array.isArray(value) ? value.filter(Boolean) : [];

export function normalizeTurnSyncPolicy(raw = {}) {
  const mode = TURN_SYNC_MODES.includes(raw.mode) ? raw.mode : 'ask';
  const payload = TURN_SYNC_PAYLOADS.includes(raw.payload) ? raw.payload : 'full_turns';
  return {
    mode,
    payload,
    standing_authorization: mode === 'on',
    requires_per_turn_prompt: mode === 'ask',
    accepted_state_authority: false
  };
}

export function shouldSyncTurn(policy, turn = {}) {
  const p = normalizeTurnSyncPolicy(policy);
  if (p.mode === 'off') return false;
  if (p.mode === 'ask') return null;
  if (p.payload === 'full_turns') return true;
  const kind = text(turn.turn_type).toLowerCase();
  if (p.payload === 'decisions_tasks') {
    return ['decision', 'task', 'task_request', 'task_result', 'handoff', 'checkpoint'].includes(kind);
  }
  // summaries mode means the provider-side bridge should append a bounded summary/reference turn,
  // not silently transform raw content in this presentation helper.
  return kind === 'summary';
}

export function normalizeConversationTurn(turn = {}) {
  return {
    turn_id: text(turn.turn_id) || null,
    conversation_id: text(turn.conversation_id) || null,
    message_id: text(turn.message_id) || null,
    seq: Number.isFinite(Number(turn.seq)) ? Number(turn.seq) : null,
    role: TURN_ROLES.includes(turn.role) ? turn.role : 'operational',
    turn_type: text(turn.turn_type) || 'message',
    actor_id: text(turn.actor_id) || text(turn.routing_envelope?.actor_id) || null,
    content_preview: text(turn.content_preview),
    content_ref: text(turn.content_ref) || null,
    created_at: text(turn.created_at) || null,
    response_ids: list(turn.response_ids),
    tool_receipt_refs: list(turn.tool_receipt_refs),
    attachment_refs: list(turn.attachment_refs),
    access_grant_ids: list(turn.access_grant_ids),
    object_refs: list(turn.object_refs),
    task_run_ids: list(turn.task_run_ids),
    routing_envelope: turn.routing_envelope && typeof turn.routing_envelope === 'object' ? turn.routing_envelope : null,
    intent_mode: text(turn.intent_mode) || null,
    accepted_state_authority: false
  };
}

export function normalizeConversationSession(session = {}) {
  const rawTurns = Array.isArray(session.turns) ? session.turns : list(session.message_log);
  const turns = rawTurns.map(normalizeConversationTurn).sort((a, b) => {
    if (a.seq != null && b.seq != null) return a.seq - b.seq;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });
  const selectedActors = uniq(session.selected_actors);
  const turnActors = uniq(turns.map(t => t.actor_id));
  const participants = uniq([session.created_by, ...selectedActors, ...turnActors]);
  return {
    schema: session.schema || 'cairnstone-conversation-session-v1',
    conversation_id: text(session.conversation_id) || null,
    status: text(session.status) || 'active',
    session_revision: Number.isFinite(Number(session.session_revision)) ? Number(session.session_revision) : null,
    created_by: text(session.created_by) || null,
    created_at: text(session.created_at) || null,
    updated_at: text(session.updated_at) || null,
    selected_actors: selectedActors,
    participants,
    selected_repo: text(session.selected_repo) || null,
    selected_chain: text(session.selected_chain) || null,
    code_session_id: text(session.code_session_id) || null,
    workspace_id: text(session.workspace_id) || null,
    intent_mode: text(session.intent_mode) || null,
    last_response_ids: list(session.last_response_ids),
    access_grant_ids: list(session.access_grant_ids),
    task_run_ids: list(session.task_run_ids),
    routing_envelope: session.routing_envelope && typeof session.routing_envelope === 'object' ? session.routing_envelope : null,
    turns,
    turn_count: turns.length,
    accepted_state_authority: false,
    project_memory_promoted: false
  };
}

export function latestTurnsByActor(turns = []) {
  const map = new Map();
  for (const raw of turns) {
    const turn = normalizeConversationTurn(raw);
    if (!turn.actor_id) continue;
    const prev = map.get(turn.actor_id);
    const prevSeq = prev?.seq ?? -1;
    const nextSeq = turn.seq ?? -1;
    if (!prev || nextSeq >= prevSeq || new Date(turn.created_at || 0) >= new Date(prev.created_at || 0)) {
      map.set(turn.actor_id, turn);
    }
  }
  return [...map.entries()].map(([actor_id, turn]) => ({ actor_id, turn }));
}

export function conversationSearchMatches(session, query) {
  const q = text(query).toLowerCase();
  if (!q) return true;
  const s = normalizeConversationSession(session);
  const haystack = [
    s.conversation_id,
    s.status,
    s.created_by,
    s.selected_repo,
    s.selected_chain,
    s.code_session_id,
    ...s.participants,
    ...s.last_response_ids,
    ...s.turns.flatMap(t => [t.turn_id, t.message_id, t.actor_id, t.turn_type, t.content_preview, t.content_ref])
  ].filter(Boolean).join('\n').toLowerCase();
  return haystack.includes(q);
}

export function conversationDigest(session) {
  const s = normalizeConversationSession(session);
  const latest = latestTurnsByActor(s.turns);
  const actorLines = latest.map(({ actor_id, turn }) => ({
    actor_id,
    turn_id: turn.turn_id,
    message_id: turn.message_id,
    turn_type: turn.turn_type,
    preview: turn.content_preview || (turn.content_ref ? `Content ref: ${turn.content_ref}` : 'No preview stored')
  }));
  return {
    conversation_id: s.conversation_id,
    status: s.status,
    turn_count: s.turn_count,
    participant_count: s.participants.length,
    participants: s.participants,
    latest_by_actor: actorLines,
    unresolved_actor_ids: s.selected_actors.filter(actor => !latest.some(x => x.actor_id === actor)),
    accepted_state_authority: false,
    note: 'Deterministic digest from stored Conversation Session metadata/previews; not an LLM summary.'
  };
}

export function buildAppendTurnArgs({ conversationId, actorId, baseRevision, turn } = {}) {
  const t = normalizeConversationTurn(turn || {});
  const errors = [];
  if (!text(conversationId)) errors.push('conversation_id required');
  if (!text(actorId)) errors.push('actor_id required');
  if (!Number.isInteger(Number(baseRevision)) || Number(baseRevision) < 1) errors.push('base_revision must be a positive integer');
  if (!t.turn_id) errors.push('turn_id required');
  if (!t.message_id) errors.push('message_id required');
  if (!TURN_ROLES.includes(t.role)) errors.push('unsupported role');
  if (t.content_preview.length > 512) errors.push('content_preview exceeds 512 characters');
  if (errors.length) return { ok: false, errors, accepted_state_authority: false };
  return {
    ok: true,
    tool: 'cairnstone_conversation_session_append_turn',
    args: {
      conversation_id: text(conversationId),
      actor_id: text(actorId),
      base_revision: Number(baseRevision),
      turn_id: t.turn_id,
      message_id: t.message_id,
      role: t.role,
      turn_type: t.turn_type,
      ...(t.content_ref ? { content_ref: t.content_ref } : {}),
      ...(t.content_preview ? { content_preview: t.content_preview } : {}),
      ...(t.response_ids.length ? { response_ids: t.response_ids } : {}),
      ...(t.tool_receipt_refs.length ? { tool_receipt_refs: t.tool_receipt_refs } : {}),
      ...(t.attachment_refs.length ? { attachment_refs: t.attachment_refs } : {}),
      ...(t.access_grant_ids.length ? { access_grant_ids: t.access_grant_ids } : {}),
      ...(t.object_refs.length ? { object_refs: t.object_refs } : {}),
      ...(t.task_run_ids.length ? { task_run_ids: t.task_run_ids } : {}),
      ...(t.routing_envelope ? { routing_envelope: t.routing_envelope } : {}),
      ...(t.intent_mode ? { intent_mode: t.intent_mode } : {})
    },
    accepted_state_authority: false
  };
}

export function buildNextActionCandidates(session) {
  const s = normalizeConversationSession(session);
  const latest = new Map(latestTurnsByActor(s.turns).map(x => [x.actor_id, x.turn]));
  const candidates = [];
  for (const actor_id of s.selected_actors.length ? s.selected_actors : s.participants) {
    const turn = latest.get(actor_id);
    if (!turn) {
      candidates.push({ id: `request:${actor_id}`, action: 'request_response', actor_id, reason: 'No stored turn from selected actor' });
    } else {
      candidates.push({
        id: `followup:${actor_id}`,
        action: 'follow_up',
        actor_id,
        turn_id: turn.turn_id,
        message_id: turn.message_id,
        reason: `Latest stored turn type: ${turn.turn_type}`
      });
    }
  }
  candidates.push({ id: 'operator:review', action: 'operator_review', reason: 'Review grouped turns before targeted dispatch' });
  return candidates;
}

export function buildJevNextActionArgs({ task, candidates } = {}) {
  const xs = list(candidates);
  if (!xs.length) return { ok: false, errors: ['at least one candidate required'], accepted_state_authority: false };
  return {
    ok: true,
    tool: 'ask_jev',
    args: {
      kind: 'next_action',
      task: text(task) || 'Rank the safest, most useful next action for this conversation group.',
      candidates: xs
    },
    accepted_state_authority: false
  };
}
