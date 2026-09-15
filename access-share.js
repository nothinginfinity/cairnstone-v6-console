/**
 * V7.7.10b — Give Access / Assign / Forward-with-note (Console presentation).
 *
 * Canonical-object sharing over typed object refs. Does not duplicate payloads
 * for visibility. Never moves chain/path HEADs. Never calls set_head / set_path_head.
 * Aligned to live worker 0.5.40 MCP schemas (additionalProperties: false).
 */

/** Live MCP tools (worker 0.5.40+). */
export const ACCESS_GRANT_TOOLS = Object.freeze({
  create: 'cairnstone_access_grant_create',
  get: 'cairnstone_access_grant_get',
  list: 'cairnstone_access_grant_list',
  revoke: 'cairnstone_access_grant_revoke',
  markFirstRead: 'cairnstone_access_grant_mark_first_read',
  attachmentResolve: 'cairnstone_attachment_ref_resolve',
  /** Assign creates a Task Run proposal only — dispatch waits for 10d/10e. */
  taskRunPropose: 'cairnstone_task_run_propose',
  forwardWithNote: 'cairnstone_forward_with_note',
  /** Fallback when forward_with_note is absent from the catalog. */
  sendMessage: 'cairnstone_send_message'
});

/** Exact allowlists matching live worker inputSchema (additionalProperties: false). */
export const MCP_ARG_KEYS = Object.freeze({
  [ACCESS_GRANT_TOOLS.create]: Object.freeze([
    'grant_id', 'object_ref', 'principal_actor_id', 'permission',
    'grantor_actor_id', 'actor_id', 'expires_at', 'notify'
  ]),
  [ACCESS_GRANT_TOOLS.revoke]: Object.freeze(['grant_id', 'actor_id']),
  [ACCESS_GRANT_TOOLS.list]: Object.freeze([
    'actor_id', 'principal_actor_id', 'object_ref', 'grantor_actor_id', 'status', 'limit'
  ]),
  [ACCESS_GRANT_TOOLS.taskRunPropose]: Object.freeze([
    'task_run_id', 'requested_by', 'actor_id', 'assignee_actor_id', 'principal_actor_id',
    'conversation_id', 'parent_turn_id', 'attachment_refs', 'object_refs', 'note', 'requested_intent'
  ]),
  [ACCESS_GRANT_TOOLS.attachmentResolve]: Object.freeze([
    'actor_id', 'object_ref', 'object_refs', 'refs', 'attachment_set',
    'conversation_id', 'apply', 'base_revision'
  ]),
  [ACCESS_GRANT_TOOLS.forwardWithNote]: Object.freeze([
    'from', 'actor_id', 'to', 'note', 'object_ref', 'original_object_ref', 'original',
    'message_id', 'thread_id', 'intent', 'priority', 'subject', 'labels', 'scope'
  ]),
  [ACCESS_GRANT_TOOLS.sendMessage]: Object.freeze([
    'from', 'to', 'content', 'message_id', 'thread_id', 'intent', 'priority', 'subject', 'labels', 'scope'
  ])
});

export const GRANT_PERMISSIONS = Object.freeze(['read', 'discuss', 'execute-against']);

export const GRANT_STATUSES = Object.freeze(['granted', 'first_read', 'revoked']);

export const SHARE_MODES = Object.freeze(['give-access', 'assign', 'forward', 'grants']);

export const OBJECT_REF_KINDS = Object.freeze([
  'msg',
  'ac1',
  'stone',
  'repo',
  'session',
  'response',
  'conversation',
  'turn',
  'grounded-response'
]);

export const HUMAN_COMMIT_OPS = Object.freeze([
  'grant',
  'revoke',
  'assign-proposal',
  'forward-with-note'
]);

const OBJECT_REF_RE = /^(msg|ac1|stone|repo|session|response|conversation|turn|grounded-response):(.+)$/i;

/**
 * Strip UI-only fields and enforce the live tool allowlist.
 * @param {string} toolName
 * @param {Record<string, unknown>} args
 */
export function sanitizeMcpArgs(toolName, args = {}) {
  const allowed = MCP_ARG_KEYS[toolName];
  const src = args && typeof args === 'object' ? args : {};
  const out = {};
  if (Array.isArray(allowed)) {
    for (const key of allowed) {
      if (src[key] !== undefined && src[key] !== null) out[key] = src[key];
    }
    return out;
  }
  // Unknown tool: still strip authority / dispatch UI flags.
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined || v === null) continue;
    if (k === 'accepted_state_authority' || k === 'auto_dispatch' || k === 'status') continue;
    out[k] = v;
  }
  return out;
}

/** Prefer proposal.mcpArgs; fall back to sanitizing legacy proposal.args. */
export function mcpArgsFromProposal(proposal) {
  if (!proposal) return {};
  const tool = proposal.mcp_tool;
  if (proposal.mcpArgs && typeof proposal.mcpArgs === 'object') {
    return sanitizeMcpArgs(tool, proposal.mcpArgs);
  }
  return sanitizeMcpArgs(tool, proposal.args || {});
}

/**
 * Parse a typed canonical object ref string.
 * @param {string} raw
 * @returns {{ kind: string, id: string, raw: string } | null}
 */
export function parseObjectRef(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const m = s.match(OBJECT_REF_RE);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const id = m[2].trim();
  if (!id) return null;
  return { kind, id, raw: `${kind}:${id}` };
}

/**
 * Format a typed object ref.
 * @param {string} kind
 * @param {string} id
 */
export function formatObjectRef(kind, id) {
  const k = String(kind || '').trim().toLowerCase();
  const i = String(id || '').trim();
  if (!k || !i) return null;
  if (!OBJECT_REF_KINDS.includes(k) && k !== 'grounded-response') return null;
  return `${k}:${i}`;
}

export function objectRefFromMessage(message = {}) {
  const messageId = message.message_id || message.id;
  const stoneHash = message.stone_hash || message.hash;
  if (messageId) {
    return {
      object_ref: formatObjectRef('msg', messageId),
      kind: 'msg',
      label: message.subject || messageId,
      secondary_refs: stoneHash ? [formatObjectRef('stone', stoneHash)] : [],
      source: 'message'
    };
  }
  if (stoneHash) {
    return {
      object_ref: formatObjectRef('ac1', stoneHash),
      kind: 'ac1',
      label: message.subject || stoneHash,
      secondary_refs: [],
      source: 'message'
    };
  }
  return null;
}

export function objectRefFromStone(stone = {}) {
  const hash = stone.hash || stone.stone_hash;
  if (!hash) return null;
  const secondary = [];
  const repo = stone.repo || null;
  const commit = stone.commit || stone.commit_sha || null;
  if (repo && commit) secondary.push(formatObjectRef('repo', `${repo}@${commit}`));
  else if (repo) secondary.push(formatObjectRef('repo', repo));
  return {
    object_ref: formatObjectRef('stone', hash),
    kind: 'stone',
    label: stone.title || stone.path || hash,
    secondary_refs: secondary.filter(Boolean),
    source: 'stone'
  };
}

export function objectRefFromRepo({ repo, commit_sha, commit } = {}) {
  const r = String(repo || '').trim();
  if (!r) return null;
  const sha = String(commit_sha || commit || '').trim();
  const id = sha ? `${r}@${sha}` : r;
  return {
    object_ref: formatObjectRef('repo', id),
    kind: 'repo',
    label: id,
    secondary_refs: [],
    source: 'repo'
  };
}

export function objectRefFromCodeSession(sessionId) {
  const id = String(sessionId || '').trim();
  if (!id) return null;
  return {
    object_ref: formatObjectRef('session', id),
    kind: 'session',
    label: id,
    secondary_refs: [],
    source: 'code-session'
  };
}

export function objectRefFromResponse(result = {}) {
  const responseId = result.response_id || result.id;
  if (!responseId) return null;
  return {
    object_ref: formatObjectRef('response', responseId),
    kind: 'response',
    label: responseId,
    secondary_refs: [],
    source: 'evidence'
  };
}

export function permissionLabel(permission) {
  const p = String(permission || '').toLowerCase();
  if (p === 'read') return 'Read — visibility only; no execute / mutate';
  if (p === 'discuss') return 'Discuss — may attach into Conversation Session; no mutate / execute';
  if (p === 'execute-against') {
    return 'Execute-against — visibility only until a human-committed Task Run; grant alone does not execute';
  }
  return 'Unknown permission';
}

export function permissionImpliesExecute(permission) {
  return false; // grant alone never executes, even for execute-against
}

export function grantStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'granted') return 'Granted';
  if (s === 'first_read') return 'First read';
  if (s === 'revoked') return 'Revoked (future access blocked)';
  return status || 'Unknown';
}

/**
 * Build a Give Access proposal (presentation). Requires human Commit before MCP create.
 * UI may carry accepted_state_authority; MCP args never include it.
 */
export function buildAccessGrantProposal({
  object_ref,
  principal_actor_id,
  permission = 'read',
  grantor_actor_id,
  notify = false,
  expires_at = null,
  grant_id = null
} = {}) {
  const ref = parseObjectRef(object_ref);
  const principal = String(principal_actor_id || '').trim();
  const grantor = String(grantor_actor_id || '').trim();
  const perm = String(permission || 'read').toLowerCase();
  const errors = [];
  if (!ref) errors.push('Canonical object_ref is required');
  if (!principal) errors.push('Principal (recipient actor) is required');
  if (!GRANT_PERMISSIONS.includes(perm)) errors.push('Permission must be read | discuss | execute-against');
  if (!grantor) errors.push('Grantor actor is required');

  const mcpArgs = sanitizeMcpArgs(ACCESS_GRANT_TOOLS.create, {
    grant_id: grant_id || undefined,
    object_ref: ref?.raw || null,
    principal_actor_id: principal || null,
    permission: GRANT_PERMISSIONS.includes(perm) ? perm : null,
    grantor_actor_id: grantor || null,
    notify: Boolean(notify),
    expires_at: expires_at || undefined
  });

  return {
    ok: errors.length === 0,
    errors,
    operation: 'grant',
    human_commit_required: true,
    schema: 'cairnstone-access-grant-v1',
    accepted_state_authority: false,
    duplicates_payload: false,
    permission_implies_execute: permissionImpliesExecute(perm),
    mcp_tool: ACCESS_GRANT_TOOLS.create,
    mcpArgs,
    /** @deprecated use mcpArgs — kept for UI summary only (may contain extras historically) */
    args: mcpArgs,
    summary: errors.length
      ? errors.join('; ')
      : `Give ${principal} ${perm} on ${ref.raw}${notify ? ' · notify' : ''}`
  };
}

/**
 * Assign / Ask to work — Task Run proposal over the same object refs (not auto-dispatch).
 * MCP args: attachment_refs + assignee_actor_id + requested_by + note (no status/auto_dispatch).
 */
export function buildAssignProposal({
  object_refs = [],
  assignee_actor_id,
  requester_actor_id,
  task = '',
  title = '',
  task_run_id = null,
  conversation_id = null,
  parent_turn_id = null,
  requested_intent = null
} = {}) {
  const refs = (Array.isArray(object_refs) ? object_refs : [object_refs])
    .map(r => (typeof r === 'string' ? parseObjectRef(r)?.raw : parseObjectRef(r?.object_ref || r?.raw)?.raw))
    .filter(Boolean);
  const assignee = String(assignee_actor_id || '').trim();
  const requester = String(requester_actor_id || '').trim();
  const taskText = String(task || title || '').trim();
  const errors = [];
  if (!refs.length) errors.push('At least one canonical object_ref is required');
  if (!assignee) errors.push('Assignee actor is required');
  if (!requester) errors.push('Requester actor is required');
  if (!taskText) errors.push('Task / ask text is required');

  const mcpArgs = sanitizeMcpArgs(ACCESS_GRANT_TOOLS.taskRunPropose, {
    task_run_id: task_run_id || undefined,
    attachment_refs: refs,
    assignee_actor_id: assignee || null,
    requested_by: requester || null,
    note: taskText || null,
    conversation_id: conversation_id || undefined,
    parent_turn_id: parent_turn_id || undefined,
    requested_intent: requested_intent || undefined
  });

  return {
    ok: errors.length === 0,
    errors,
    operation: 'assign-proposal',
    human_commit_required: true,
    auto_dispatch: false,
    schema: 'cairnstone-task-run-v1',
    status: 'proposed',
    accepted_state_authority: false,
    grants_access: false,
    note: 'Assign does not grant access by itself; pair with Give Access when visibility is needed.',
    mcp_tool: ACCESS_GRANT_TOOLS.taskRunPropose,
    mcpArgs,
    args: mcpArgs,
    summary: errors.length
      ? errors.join('; ')
      : `Ask ${assignee} to work on ${refs.join(', ')} (proposal only)`
  };
}

/**
 * Forward with note — prefer cairnstone_forward_with_note; fall back to send_message.
 * @param {{ preferForwardTool?: boolean, forwardToolAvailable?: boolean|null }} opts
 */
export function buildForwardWithNotePayload({
  from,
  to,
  note = '',
  original_object_ref,
  subject = 'Forward with note',
  thread_id = null,
  intent = 'message',
  preferForwardTool = true,
  forwardToolAvailable = null
} = {}) {
  const sender = String(from || '').trim();
  const recipients = (Array.isArray(to) ? to : String(to || '').split(','))
    .map(s => String(s || '').trim())
    .filter(Boolean);
  const commentary = String(note || '').trim();
  const original = parseObjectRef(original_object_ref);
  const errors = [];
  if (!sender) errors.push('From actor is required');
  if (!recipients.length) errors.push('At least one recipient is required');
  if (!commentary) errors.push('Forward note / commentary is required');
  if (!original) errors.push('Original canonical object_ref is required');

  const useForward = preferForwardTool && forwardToolAvailable !== false;
  if (useForward) {
    const mcpArgs = sanitizeMcpArgs(ACCESS_GRANT_TOOLS.forwardWithNote, {
      from: sender || null,
      to: recipients.length === 1 ? recipients[0] : recipients,
      note: commentary || null,
      object_ref: original?.raw || null,
      subject: String(subject || 'Forward with note').trim() || 'Forward with note',
      thread_id: thread_id || undefined,
      intent: intent || 'message'
    });
    return {
      ok: errors.length === 0,
      errors,
      operation: 'forward-with-note',
      human_commit_required: true,
      creates_new_correspondence: true,
      duplicates_canonical_payload: false,
      mcp_tool: ACCESS_GRANT_TOOLS.forwardWithNote,
      fallback_mcp_tool: ACCESS_GRANT_TOOLS.sendMessage,
      mcpArgs,
      args: mcpArgs,
      summary: errors.length
        ? errors.join('; ')
        : `Forward ${original.raw} to ${recipients.join(', ')} with note`
    };
  }

  const content = [
    commentary,
    '',
    '---',
    `References original object_ref: ${original?.raw || '(missing)'}`,
    'This is Forward with note (new AC1 correspondence). It is not Give Access.',
    'Correspondence transports intent only; no execution authority.'
  ].join('\n');

  const mcpArgs = sanitizeMcpArgs(ACCESS_GRANT_TOOLS.sendMessage, {
    from: sender || null,
    to: recipients,
    subject: String(subject || 'Forward with note').trim() || 'Forward with note',
    intent: 'message',
    labels: ['informational', 'work-plane'],
    content
  });

  return {
    ok: errors.length === 0,
    errors,
    operation: 'forward-with-note',
    human_commit_required: true,
    creates_new_correspondence: true,
    duplicates_canonical_payload: false,
    mcp_tool: ACCESS_GRANT_TOOLS.sendMessage,
    mcpArgs,
    args: mcpArgs,
    summary: errors.length
      ? errors.join('; ')
      : `Forward ${original.raw} to ${recipients.join(', ')} with note (send_message fallback)`
  };
}

export function buildRevokeProposal({ grant_id, actor_id } = {}) {
  const grantId = String(grant_id || '').trim();
  const actor = String(actor_id || '').trim();
  const errors = [];
  if (!grantId) errors.push('grant_id is required');
  if (!actor) errors.push('actor_id is required');
  const mcpArgs = sanitizeMcpArgs(ACCESS_GRANT_TOOLS.revoke, {
    grant_id: grantId || null,
    actor_id: actor || null
  });
  return {
    ok: errors.length === 0,
    errors,
    operation: 'revoke',
    human_commit_required: true,
    future_access_only: true,
    erases_already_read: false,
    accepted_state_authority: false,
    mcp_tool: ACCESS_GRANT_TOOLS.revoke,
    mcpArgs,
    args: mcpArgs,
    summary: errors.length
      ? errors.join('; ')
      : `Revoke grant ${grantId} (blocks future access only)`
  };
}

/**
 * Build attachment resolve MCP args for live cairnstone_attachment_ref_resolve.
 */
export function buildAttachmentResolveArgs({ object_ref, object_refs, actor_id } = {}) {
  const refs = [];
  if (object_ref) {
    const p = parseObjectRef(object_ref);
    if (p) refs.push(p.raw);
  }
  for (const r of object_refs || []) {
    const p = typeof r === 'string' ? parseObjectRef(r) : parseObjectRef(r?.object_ref || r?.raw);
    if (p) refs.push(p.raw);
  }
  const unique = [...new Set(refs)];
  return sanitizeMcpArgs(ACCESS_GRANT_TOOLS.attachmentResolve, {
    actor_id: actor_id || undefined,
    object_ref: unique.length === 1 ? unique[0] : undefined,
    object_refs: unique.length ? unique : undefined
  });
}

/**
 * Detect whether an MCP error means the tool is missing on the worker.
 */
export function isToolMissingError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  const payload = err?.payload;
  const code = String(payload?.error || payload?.code || '').toLowerCase();
  return (
    /unknown tool|tool not found|method not found|not available|does not exist|no such tool|unsupported tool/.test(msg)
    || /unknown_tool|tool_not_found|not_found/.test(code)
    || (payload?.ok === false && /access_grant|attachment_ref_resolve|attachment_resolve|task_run_propose|forward_with_note/.test(msg))
  );
}

export function toolMissingHonesty(toolName, { workerHint = '0.5.40' } = {}) {
  const tool = String(toolName || 'grant API');
  return {
    ok: false,
    available: false,
    tool,
    title: 'Worker API not available yet',
    body: `${tool} is not on this runtime. Grant / attachment-resolve APIs land with worker ${workerHint}. Console UX is wired; Commit stays blocked until the tool exists. Presentation never invents grants or moves HEADs.`,
    accepted_state_authority: false
  };
}

export function summarizeProposalCard(proposal) {
  if (!proposal) {
    return { title: 'No proposal', lines: ['Open Give access, Assign, or Forward with note on a selected object.'] };
  }
  const lines = [
    `Operation: ${proposal.operation}`,
    `Human Commit: ${proposal.human_commit_required ? 'required' : 'not required'}`,
    `MCP: ${proposal.mcp_tool || '—'}`,
    `Accepted-state authority: ${proposal.accepted_state_authority === true ? 'true' : 'false'}`
  ];
  if (proposal.duplicates_payload === false) lines.push('Does not duplicate canonical payload for visibility');
  if (proposal.auto_dispatch === false) lines.push('Does not auto-dispatch');
  if (proposal.future_access_only) lines.push('Revoke blocks future access only');
  if (proposal.grants_access === false) lines.push('Assign does not grant access by itself');
  if (proposal.summary) lines.push(proposal.summary);
  if (proposal.errors?.length) lines.push(`Blocked: ${proposal.errors.join('; ')}`);
  return {
    title: proposal.ok ? 'Ready for human Commit' : 'Incomplete proposal',
    lines
  };
}

/**
 * Resolve attachment/object ref via worker when available; otherwise return local parse.
 */
export function localResolveAttachment(objectRef) {
  const parsed = parseObjectRef(objectRef);
  if (!parsed) {
    return {
      ok: false,
      error: 'unrecognized_object_ref',
      message: 'Object ref must be typed (msg:… / stone:… / repo:… / session:… / response:… / conversation:…).',
      accepted_state_authority: false
    };
  }
  return {
    ok: true,
    resolved_locally: true,
    object_ref: parsed.raw,
    kind: parsed.kind,
    id: parsed.id,
    note: 'Local parse only. Worker cairnstone_attachment_ref_resolve hydrates metadata when 0.5.40+ is live.',
    accepted_state_authority: false
  };
}

export function shareModeLabel(mode) {
  if (mode === 'give-access') return 'Give access…';
  if (mode === 'assign') return 'Assign / Ask to work';
  if (mode === 'forward') return 'Forward with note';
  if (mode === 'grants') return 'Access grants';
  return 'Share';
}

export function entrySurfaces() {
  return Object.freeze([
    { surface: 'inbox', path: 'Primary → Inbox → message → Give access / Assign / Forward' },
    { surface: 'message-reader', path: 'Message Reader (inline or mobile sheet) action bar' },
    { surface: 'stones', path: 'Primary → More → Stones → detail actions' },
    { surface: 'evidence', path: 'Chat Evidence drawer / More → Evidence' },
    { surface: 'work', path: 'Primary → Work (Code Session) actions' },
    { surface: 'access', path: 'Primary → More → Access (grant lifecycle)' }
  ]);
}

/** Static authority check for share module source. */
export function assertShareNeverMovesHeads(sourceText) {
  const src = String(sourceText || '');
  const hits = [];
  for (const tool of ['cairnstone_set_head', 'cairnstone_set_path_head']) {
    if (new RegExp(`mcpCall\\(\\s*['"]${tool}['"]`).test(src)) hits.push(tool);
  }
  return { ok: hits.length === 0, mcpHeadCalls: hits };
}
