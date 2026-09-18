/**
 * V7.7.10g — Worker context retention preview helpers.
 */

export const PREVIEW_TOOL = 'cairnstone_context_retention_preview';
export const RETENTION_SCHEMA = 'cairnstone-context-retention-v1';

const PREVIEW_ARG_KEYS = Object.freeze(['actor_id', 'candidates', 'items']);

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

function cleanRows(value) {
  if (!Array.isArray(value) || !value.length) return undefined;
  const rows = value.filter(row => row && typeof row === 'object' && !Array.isArray(row));
  return rows.length ? rows : undefined;
}

function normalizeDecisions(result = {}) {
  const rows = Array.isArray(result.decisions)
    ? result.decisions
    : Array.isArray(result.preview?.decisions)
      ? result.preview.decisions
      : Array.isArray(result.items)
        ? result.items
        : [];
  return rows.map((row) => ({
    action: String(row?.action || row?.decision || row?.retention_action || 'KEEP_REF').trim() || 'KEEP_REF',
    class: String(row?.class || row?.class_name || row?.category || 'unknown').trim() || 'unknown',
    reason: String(row?.reason || row?.why || row?.rationale || '—').trim() || '—'
  }));
}

export function buildPreviewArgs({ actor_id, candidates, items } = {}) {
  return pickAllowedArgs(PREVIEW_ARG_KEYS, {
    actor_id: cleanText(actor_id),
    candidates: cleanRows(candidates),
    items: cleanRows(items)
  });
}

export function compileRetentionCard(result = {}, { toolsAvailable } = {}) {
  if (!toolsAvailable) {
    return {
      ok: false,
      error: 'tool_unavailable',
      tool: PREVIEW_TOOL,
      schema: RETENTION_SCHEMA,
      title: 'Retention preview blocked',
      lines: [
        `Tool: ${PREVIEW_TOOL}`,
        `Schema: ${RETENTION_SCHEMA}`,
        'Accepted-state authority: false',
        'Storage deleted: false'
      ],
      accepted_state_authority: false,
      storage_deleted: false,
      honesty: 'Worker 10g retention preview tool is not on this runtime. Presentation never invents PIN/DROP decisions.'
    };
  }
  const decisions = normalizeDecisions(result);
  const hasError = result?.ok === false || Boolean(result?.error);
  const lines = [
    `Tool: ${PREVIEW_TOOL}`,
    `Schema: ${RETENTION_SCHEMA}`,
    'Accepted-state authority: false',
    'Storage deleted: false'
  ];
  if (decisions.length) {
    for (const row of decisions) {
      lines.push(`${row.action} · ${row.class} · ${row.reason}`);
    }
  } else if (hasError) {
    lines.push(`Blocked: ${result.error || 'Retention preview failed'}`);
  } else {
    lines.push('No retention decisions returned.');
  }
  return {
    ok: !hasError,
    tool: PREVIEW_TOOL,
    schema: RETENTION_SCHEMA,
    title: hasError ? 'Retention preview blocked' : 'Retention preview ready',
    decisions,
    lines,
    error: hasError ? (result.error || 'worker_error') : null,
    accepted_state_authority: false,
    storage_deleted: false
  };
}

export function summarizeRetentionCard(card) {
  if (!card) return 'No retention preview result yet.';
  const title = String(card.title || (card.ok ? 'Ready' : 'Blocked')).trim();
  const lines = Array.isArray(card.lines) && card.lines.length
    ? card.lines.slice()
    : [card.honesty, card.error].filter(Boolean);
  if (card.honesty && !lines.includes(card.honesty)) lines.push(card.honesty);
  return [title, ...lines].filter(Boolean).join('\n');
}
