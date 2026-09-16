/**
 * V7.7.10e — Intent route / proposal commit / dispatch Human Commit helpers.
 *
 * Presentation only. Never calls set_head / set_path_head.
 */

export const INTENT_TOOLS = Object.freeze({
  route: 'cairnstone_intent_route',
  propose: 'cairnstone_task_run_propose',
  dispatch: 'cairnstone_task_run_dispatch'
});

const PROPOSAL_TOOL_ARG_KEYS = Object.freeze({
  [INTENT_TOOLS.propose]: Object.freeze([
    'task_run_id',
    'requested_by',
    'actor_id',
    'assignee_actor_id',
    'principal_actor_id',
    'conversation_id',
    'parent_turn_id',
    'attachment_refs',
    'object_refs',
    'note',
    'requested_intent'
  ]),
  [INTENT_TOOLS.dispatch]: Object.freeze([
    'task_run_id',
    'human_commit',
    'committed_by',
    'preferred_executor',
    'policy_preset',
    'base_commit_sha'
  ])
});

const ROUTE_ARG_KEYS = Object.freeze(['text', 'actor_id', 'code_session_id']);
const HUMAN_COMMIT_INTENTS = new Set(['assign', 'give-access', 'revoke', 'forward-with-note']);

export const INTENT_PROPOSAL_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'proposal', 'require_human_commit', 'auto_mutated', 'dispatched', 'accepted_state_authority'],
  properties: {
    intent: { type: 'string' },
    proposal: { type: ['object', 'null'] },
    require_human_commit: { type: 'boolean' },
    auto_mutated: { type: 'boolean' },
    dispatched: { type: 'boolean' },
    accepted_state_authority: { type: 'boolean' },
    next_action: { type: ['string', 'null'] },
    task_run_id: { type: ['string', 'null'] }
  }
});

export const DISPATCH_COMMIT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['task_run_id', 'human_commit', 'committed_by'],
  properties: {
    task_run_id: { type: 'string' },
    human_commit: { const: true },
    committed_by: { type: 'string' },
    preferred_executor: { type: 'string' },
    policy_preset: { type: 'string' },
    base_commit_sha: { type: 'string' }
  }
});

export function pickAllowedArgs(allowedKeys, source = {}) {
  const src = source && typeof source === 'object' ? source : {};
  const out = {};
  for (const key of allowedKeys || []) {
    if (key === 'accepted_state_authority') continue;
    const value = src[key];
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

export function buildIntentRouteArgs({ text, actor_id, code_session_id } = {}) {
  const cleanText = String(text || '').trim();
  const errors = [];
  if (!cleanText) errors.push('Intent text is required');
  const args = pickAllowedArgs(ROUTE_ARG_KEYS, {
    text: cleanText,
    actor_id: String(actor_id || '').trim() || undefined,
    code_session_id: String(code_session_id || '').trim() || undefined
  });
  return {
    ok: errors.length === 0,
    errors,
    args
  };
}

function normalizeIntent(value, fallback = 'none') {
  const raw = String(value || fallback).trim().toLowerCase().replace(/_/g, '-');
  if (!raw) return fallback;
  if (raw === 'giveaccess') return 'give-access';
  if (raw === 'forwardwithnote') return 'forward-with-note';
  return raw;
}

function findProposal(payload = {}) {
  if (payload.proposal && typeof payload.proposal === 'object') return payload.proposal;
  if (payload.result?.proposal && typeof payload.result.proposal === 'object') return payload.result.proposal;
  return null;
}

function findTaskRunId(payload = {}) {
  return String(
    payload.task_run_id
    || payload.task_run?.task_run_id
    || payload.task_run?.id
    || payload.proposal?.task_run_id
    || payload.proposal?.args?.task_run_id
    || payload.proposal?.mcp_args?.task_run_id
    || payload.proposal?.mcpArgs?.task_run_id
    || ''
  ).trim() || null;
}

function findTaskStatus(payload = {}) {
  return normalizeIntent(
    payload.task_status
    || payload.status
    || payload.task_run?.status
    || payload.proposal?.status
    || '',
    ''
  ) || null;
}

function findReceiptKind(payload = {}) {
  const receipts = payload.receipts
    || payload.task_run?.receipts
    || payload.dispatch?.receipts
    || [];
  if (Array.isArray(receipts)) {
    for (const row of receipts) {
      const kind = String(row?.receipt_kind || row?.kind || row?.type || row?.name || '').trim();
      if (kind) return kind;
    }
  }
  return null;
}

function proposalArgsFrom(payload = {}, proposal = findProposal(payload)) {
  const source = proposal?.mcp_args || proposal?.mcpArgs || proposal?.args || payload.mcp_args || payload.args || {};
  const tool = proposal?.mcp_tool || payload.mcp_tool || null;
  const allowed = PROPOSAL_TOOL_ARG_KEYS[tool];
  return Array.isArray(allowed)
    ? pickAllowedArgs(allowed, source)
    : pickAllowedArgs(Object.keys(source || {}).filter(key => key !== 'accepted_state_authority'), source);
}

export function compileIntentProposalCard(routeResult = {}) {
  const proposal = findProposal(routeResult);
  const intent = normalizeIntent(
    routeResult.intent
    || routeResult.intent_name
    || routeResult.route?.intent
    || routeResult.route_result?.intent
    || proposal?.operation
    || proposal?.intent
    || 'none'
  );
  const require_human_commit = HUMAN_COMMIT_INTENTS.has(intent);
  const proposalTool = proposal?.mcp_tool || null;
  const proposalArgs = proposalTool ? proposalArgsFrom(routeResult, proposal) : {};
  const task_run_id = findTaskRunId(routeResult);
  const summary = String(routeResult.summary || proposal?.summary || '').trim();
  const blocked = Array.isArray(routeResult.errors) ? routeResult.errors : [];
  const hasBlockingErrors = routeResult.ok === false || blocked.length > 0;
  const hasProposal = Boolean(proposal && proposalTool);
  const ok = !hasBlockingErrors && (intent === 'none' || hasProposal);
  const lines = [
    `Intent: ${intent}`,
    `Human Commit: ${require_human_commit ? 'required' : 'not required'}`,
    `Auto-mutated: false`,
    `Dispatched: false`,
    `Accepted-state authority: false`
  ];
  if (proposalTool) lines.push(`Proposal MCP: ${proposalTool}`);
  if (task_run_id) lines.push(`Task Run: ${task_run_id}`);
  if (summary) lines.push(summary);
  if (blocked.length) lines.push(`Blocked: ${blocked.join('; ')}`);
  return {
    ok,
    intent,
    proposal: proposalTool ? { mcp_tool: proposalTool, args: proposalArgs } : null,
    require_human_commit,
    human_commit_required: require_human_commit,
    auto_mutated: false,
    dispatched: false,
    accepted_state_authority: false,
    next_action: intent === 'assign' ? 'propose_task_run' : null,
    task_run_id,
    title: ok ? 'Intent proposal ready' : 'Intent proposal blocked',
    lines
  };
}

export function commitProposalTool(proposalCard, { human_commit, committed_by } = {}) {
  const committedBy = String(committed_by || '').trim();
  const humanCommitRequired = proposalCard?.require_human_commit === true;
  if (proposalCard?.ok !== true) {
    return {
      ok: false,
      error: 'proposal_not_ready',
      human_commit_required: humanCommitRequired,
      accepted_state_authority: false,
      dispatched: false
    };
  }
  if (humanCommitRequired && human_commit !== true) {
    return {
      ok: false,
      error: 'human_commit_required',
      human_commit_required: humanCommitRequired,
      accepted_state_authority: false,
      dispatched: false
    };
  }
  if (!committedBy) {
    return {
      ok: false,
      error: 'committed_by_required',
      human_commit_required: humanCommitRequired,
      accepted_state_authority: false,
      dispatched: false
    };
  }
  const tool = proposalCard?.proposal?.mcp_tool || null;
  const args = proposalCard?.proposal?.args || {};
  if (!tool) {
    return {
      ok: false,
      error: 'no_proposal_tool',
      human_commit_required: humanCommitRequired,
      accepted_state_authority: false,
      dispatched: false
    };
  }
  return {
    ok: true,
    mcp_tool: tool,
    args: proposalArgsFrom({ mcp_tool: tool, args }),
    human_commit_required: humanCommitRequired,
    human_commit_recorded: true,
    committed_by: committedBy,
    dispatched: false,
    accepted_state_authority: false
  };
}

export function compileDispatchCommitCard(taskRun = {}) {
  const task_run_id = findTaskRunId(taskRun);
  const status = findTaskStatus(taskRun);
  const dispatchable = status === 'proposed';
  const receipt_kind = dispatchable ? 'compiled_transmitted' : null;
  const lines = [
    `Task Run: ${task_run_id || '—'}`,
    `Status: ${status || 'unknown'}`,
    `Dispatchable: ${dispatchable ? 'yes' : 'no'}`,
    'Human Commit: required',
    'Accepted-state authority: false'
  ];
  if (receipt_kind) lines.push(`Receipt: ${receipt_kind}`);
  return {
    ok: Boolean(task_run_id) && dispatchable,
    task_run_id,
    status,
    dispatchable,
    human_commit_required: true,
    accepted_state_authority: false,
    receipt_kind,
    title: dispatchable ? 'Dispatch ready' : 'Dispatch blocked',
    lines
  };
}

export function buildDispatchCommitArgs({
  task_run_id,
  human_commit,
  committed_by,
  preferred_executor,
  policy_preset,
  base_commit_sha
} = {}) {
  const taskRunId = String(task_run_id || '').trim();
  const committedBy = String(committed_by || '').trim();
  const errors = [];
  if (human_commit !== true) errors.push('Human Commit is required');
  if (!taskRunId) errors.push('task_run_id is required');
  if (!committedBy) errors.push('committed_by is required');
  const args = pickAllowedArgs(PROPOSAL_TOOL_ARG_KEYS[INTENT_TOOLS.dispatch], {
    task_run_id: taskRunId || undefined,
    human_commit: human_commit === true ? true : undefined,
    committed_by: committedBy || undefined,
    preferred_executor: String(preferred_executor || '').trim() || undefined,
    policy_preset: String(policy_preset || '').trim() || undefined,
    base_commit_sha: String(base_commit_sha || '').trim() || undefined
  });
  return {
    ok: errors.length === 0,
    errors,
    args
  };
}

export function summarizeProposalCard(card) {
  if (!card) return { title: 'No proposal', lines: ['Route intent from Work to see a proposal or dispatch card.'] };
  const title = String(card.title || (card.ok ? 'Ready' : 'Blocked')).trim();
  const lines = Array.isArray(card.lines) && card.lines.length
    ? card.lines.slice()
    : [
      `Accepted-state authority: ${card.accepted_state_authority === true ? 'true' : 'false'}`,
      `Dispatched: ${card.dispatched === true ? 'true' : 'false'}`
    ];
  return { title, lines };
}
