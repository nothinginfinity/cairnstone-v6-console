/**
 * V7.7.9c — Work surface helpers (presentation only).
 * Shapes cairnstone_code_session_console_view into a task-first progressive model.
 * Never invents accepted-state authority; runtime fields remain worker truth.
 */

/** Known operator actions → existing APIs only (no new Console authority). */
export const WORK_ACTION_CATALOG = Object.freeze([
  {
    id: 'invite_agent',
    label: 'Invite Agent',
    maps_to: 'V7.7.6 invite plane (POST /v1/workspace-invites · Mint & Send)',
    grants_authority: false
  },
  {
    id: 'send_message',
    label: 'Send Message',
    maps_to: 'cairnstone_send_message (AC1 correspondence only)',
    grants_authority: false
  },
  {
    id: 'checkpoints',
    label: 'Checkpoints',
    maps_to: 'cairnstone_code_checkpoint_list',
    grants_authority: false
  },
  {
    id: 'view_work',
    label: 'View Work',
    maps_to: 'cairnstone_workspace_tree_ls / cairnstone_workspace_ls',
    grants_authority: false
  },
  {
    id: 'propose_merge',
    label: 'Propose / Merge',
    maps_to: 'cairnstone_workspace_propose_accept only',
    grants_authority: false
  }
]);

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    const s = typeof v === 'string' ? v.trim() : String(v);
    if (s) return s;
  }
  return null;
}

function actorLinesFrom(data) {
  const op = data?.operator_surface || {};
  if (Array.isArray(op.actors_lines) && op.actors_lines.length) return op.actors_lines.slice();
  return (data?.actors || []).map(a => {
    const detail = a.detail ? ` · ${a.detail}` : '';
    return `${a.display || a.actor_id || 'actor'}     ${a.status || 'idle'}${detail}`;
  });
}

/**
 * Empty / loading / error / ready honesty for Work first paint.
 */
export function workSurfaceState({ loaded = false, loading = false, error = null, data = null } = {}) {
  if (loading) {
    return {
      status: 'loading',
      title: 'Loading Code Session…',
      body: 'Fetching operator snapshot from cairnstone_code_session_console_view. Console does not invent session state.',
      acceptedStateAuthority: false
    };
  }
  if (error) {
    return {
      status: 'error',
      title: 'Work surface unavailable',
      body: String(error.message || error || 'Load failed'),
      acceptedStateAuthority: false
    };
  }
  if (!loaded || !data?.ok) {
    return {
      status: 'empty',
      title: 'No Code Session loaded',
      body: 'Enter a Code Session ID and workspace capability, then load the console view. Work is presentation of runtime data only — no new accepted-state authority.',
      acceptedStateAuthority: false
    };
  }
  return {
    status: 'ready',
    title: 'Code Session loaded',
    body: 'Task-first view of worker runtime data. Deep sections expand in place; HEADs are never moved from this surface.',
    acceptedStateAuthority: data.accepted_state_authority === true ? true : false
  };
}

/**
 * Task-oriented first-paint model from console_view payload.
 * Primary: current task + lifecycle. Secondary: progressive disclosure sections.
 */
export function workFirstPaintModel(data) {
  const op = data?.operator_surface || {};
  const session = data?.persistent_code_session || {};
  const project = data?.project || {};
  const task = data?.current_task || {};

  const currentTask = firstNonEmpty(
    op.current_task_value,
    task.title,
    task.task_id,
    task.status
  ) || 'None';

  const lifecycle = firstNonEmpty(
    op.session_value,
    session.display,
    session.lifecycle,
    session.status
  ) || '—';

  const projectName = firstNonEmpty(op.project_value, project.name, project.workspace_id) || '—';
  const workspaceId = project.workspace_id
    || data?.actions?.invite_agent?.binds?.workspace_id
    || data?.permissions?.workspace_id
    || null;

  const tests = firstNonEmpty(op.tests_value, data?.tests?.summary) || '—';
  const workingTree = firstNonEmpty(op.working_tree_value, data?.working_tree?.summary) || '—';
  const actors = actorLinesFrom(data);

  const checkpoints = data?.checkpoints || data?.recent_checkpoints || [];
  const checkpointSummary = Array.isArray(checkpoints) && checkpoints.length
    ? `${checkpoints.length} recent · latest ${checkpoints[0].checkpoint_id || checkpoints[0].id || '—'}`
    : (op.checkpoints_value || 'Load Checkpoints for authoritative list');

  const environment = summarizeEnvironment(data);
  const sandbox = summarizeSandbox(data);
  const leases = summarizeLeases(data);
  const receipts = summarizeReceipts(data);
  const actions = actionCatalogFrom(data);

  return {
    ok: Boolean(data?.ok),
    currentTask,
    lifecycle,
    projectName,
    workspaceId,
    codeSessionId: session.code_session_id || null,
    taskStatus: task.status || task.state || null,
    tests,
    workingTree,
    actors,
    checkpointSummary,
    environment,
    sandbox,
    leases,
    receipts,
    actions,
    consoleGrantsNoNewAuthority: data?.console_grants_no_new_authority !== false,
    acceptedStateAuthority: data?.accepted_state_authority === true,
    sections: [
      { id: 'actors', title: 'Actors', summary: actors.length ? `${actors.length} reported` : 'None', open: false },
      { id: 'tests', title: 'Tests', summary: tests, open: false },
      { id: 'working_tree', title: 'Working tree', summary: workingTree, open: false },
      { id: 'checkpoints', title: 'Checkpoints', summary: checkpointSummary, open: false },
      { id: 'environment', title: 'Environment / sandbox', summary: [environment.summary, sandbox.summary].filter(Boolean).join(' · ') || 'Not reported', open: false },
      { id: 'leases', title: 'Leases', summary: leases.summary, open: false },
      { id: 'receipts', title: 'Receipts', summary: receipts.summary, open: false },
      { id: 'actions', title: 'Action catalog', summary: `${actions.length} operator actions → existing APIs`, open: false }
    ]
  };
}

function summarizeEnvironment(data) {
  const env = data?.environment || data?.operator_surface?.environment || null;
  if (!env) {
    return { present: false, summary: 'Not reported in console view', detail: null };
  }
  const summary = firstNonEmpty(
    env.summary,
    env.display,
    env.status,
    env.environment_id && `env ${env.environment_id}`,
    'Attached'
  );
  return { present: true, summary, detail: env };
}

function summarizeSandbox(data) {
  const sb = data?.sandbox || data?.operator_surface?.sandbox || null;
  if (!sb) {
    return { present: false, summary: 'Not reported', detail: null };
  }
  const summary = firstNonEmpty(sb.summary, sb.display, sb.status, sb.sandbox_id && `sandbox ${sb.sandbox_id}`, 'Attached');
  return { present: true, summary, detail: sb };
}

function summarizeLeases(data) {
  const leases = data?.leases || data?.operator_surface?.leases || [];
  if (!Array.isArray(leases) || !leases.length) {
    const line = data?.operator_surface?.leases_value;
    return { present: Boolean(line), summary: line || 'None reported', items: [] };
  }
  return {
    present: true,
    summary: `${leases.length} lease${leases.length === 1 ? '' : 's'}`,
    items: leases
  };
}

function summarizeReceipts(data) {
  const receipts = data?.receipts || data?.execution_receipts || data?.operator_surface?.receipts || [];
  if (!Array.isArray(receipts) || !receipts.length) {
    const line = data?.operator_surface?.receipts_value;
    return { present: Boolean(line), summary: line || 'None in snapshot', items: [] };
  }
  return {
    present: true,
    summary: `${receipts.length} receipt${receipts.length === 1 ? '' : 's'}`,
    items: receipts
  };
}

/**
 * Prefer worker action catalog when present; otherwise fall back to known Console mappings.
 */
export function actionCatalogFrom(data) {
  const raw = data?.action_catalog
    || data?.actions?.catalog
    || data?.operator_surface?.action_catalog
    || null;
  if (Array.isArray(raw) && raw.length) {
    return raw.map((row, i) => ({
      id: row.id || row.action_id || `action_${i}`,
      label: row.label || row.name || row.id || `Action ${i + 1}`,
      maps_to: row.maps_to || row.api || row.tool || row.binding || 'runtime action',
      grants_authority: row.grants_authority === true,
      available: row.available !== false && row.enabled !== false
    }));
  }
  return WORK_ACTION_CATALOG.map(a => {
    const binding = data?.actions?.[a.id];
    return {
      ...a,
      available: binding ? binding.available !== false : true,
      maps_to: binding?.maps_to || binding?.tool || a.maps_to
    };
  });
}

/** Short honesty line for Work header. */
export function workHonestyLine(model) {
  if (!model?.ok) {
    return 'Work presents Code Session runtime data only. Console never writes accepted_state_authority.';
  }
  const bits = ['Presentation only'];
  if (model.consoleGrantsNoNewAuthority) bits.push('console grants no new authority');
  bits.push(model.acceptedStateAuthority ? 'accepted_state_authority: true' : 'accepted_state_authority: false');
  return bits.join(' · ');
}
