/**
 * V7.7.8c — Console Answer Depth (response_lod) helpers.
 * Presentation-only. Never accepted project truth. Never mutates chain/path HEADs.
 * response_lod (1→5) is distinct from stone_lod (lod5→lod1).
 */

export const RESPONSE_LOD_MIN = 1;
export const RESPONSE_LOD_MAX = 5;
export const DEPTH_STORE_KEY = 'cs.answerDepth.v1';
export const THREAD_STORE_KEY = 'cs.chatThreadId.v1';
export const GROUNDED_SCHEMA = 'cairnstone-grounded-response-v1';

const LOD_LABELS = {
  1: 'Answer',
  2: 'Context',
  3: 'Evidence',
  4: 'Analysis',
  5: 'Deep trace'
};

export function clampResponseLod(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < RESPONSE_LOD_MIN || n > RESPONSE_LOD_MAX) return fallback;
  return n;
}

export function responseLodLabel(lod) {
  const n = clampResponseLod(lod, 1);
  return `LOD ${n} · ${LOD_LABELS[n]}`;
}

export function ensureChatThreadId(storage = localStorage) {
  let id = '';
  try { id = String(storage.getItem(THREAD_STORE_KEY) || '').trim(); } catch { /* ignore */ }
  if (!id) {
    id = `thread:console:${(typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now())}`;
    try { storage.setItem(THREAD_STORE_KEY, id); } catch { /* ignore */ }
  }
  return id;
}

export function loadDepthPrefs(storage = localStorage) {
  try {
    const raw = JSON.parse(storage.getItem(DEPTH_STORE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return { threadDefaults: {}, codeSessionDefaults: {} };
    return {
      threadDefaults: raw.threadDefaults && typeof raw.threadDefaults === 'object' ? raw.threadDefaults : {},
      codeSessionDefaults: raw.codeSessionDefaults && typeof raw.codeSessionDefaults === 'object' ? raw.codeSessionDefaults : {}
    };
  } catch {
    return { threadDefaults: {}, codeSessionDefaults: {} };
  }
}

export function saveDepthPrefs(prefs, storage = localStorage) {
  storage.setItem(DEPTH_STORE_KEY, JSON.stringify({
    threadDefaults: prefs.threadDefaults || {},
    codeSessionDefaults: prefs.codeSessionDefaults || {},
    updated_at: new Date().toISOString(),
    note: 'Presentation-only Answer Depth defaults. Not accepted project authority.'
  }));
}

export function resolveDefaultDepth({ threadId, codeSessionId, storage = localStorage } = {}) {
  const prefs = loadDepthPrefs(storage);
  const sid = String(codeSessionId || '').trim();
  if (sid && prefs.codeSessionDefaults[sid] != null) return clampResponseLod(prefs.codeSessionDefaults[sid], 1);
  const tid = String(threadId || '').trim();
  if (tid && prefs.threadDefaults[tid] != null) return clampResponseLod(prefs.threadDefaults[tid], 1);
  return 1;
}

export function setThreadDefaultDepth(threadId, responseLod, storage = localStorage) {
  const tid = String(threadId || '').trim();
  if (!tid) throw new Error('thread_id required for presentation default');
  const prefs = loadDepthPrefs(storage);
  prefs.threadDefaults[tid] = clampResponseLod(responseLod, 1);
  saveDepthPrefs(prefs, storage);
  return prefs.threadDefaults[tid];
}

export function setCodeSessionDefaultDepth(codeSessionId, responseLod, storage = localStorage) {
  const sid = String(codeSessionId || '').trim();
  if (!sid) throw new Error('code_session_id required for presentation default');
  const prefs = loadDepthPrefs(storage);
  prefs.codeSessionDefaults[sid] = clampResponseLod(responseLod, 1);
  saveDepthPrefs(prefs, storage);
  return prefs.codeSessionDefaults[sid];
}

/**
 * Parse natural-language Answer Depth commands from chat input.
 * Returns a command object; unknown text becomes { type: 'ask', question }.
 */
export function parseAnswerDepthCommand(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return { type: 'empty' };

  const expandThat = text.match(/^(?:lod|answer\s*depth)\s*([1-5])\s*(?:that|this|please)?[.!?]*$/i)
    || text.match(/^(?:give\s+me\s+(?:the\s+)?|show\s+(?:me\s+)?(?:the\s+)?|expand\s+(?:to\s+)?|open\s+)(?:lod|answer\s*depth)\s*([1-5])(?:\s+version)?[.!?]*$/i)
    || text.match(/^(?:lod|answer\s*depth)\s*([1-5])\s+version[.!?]*$/i);
  if (expandThat) {
    return { type: 'expand', response_lod: clampResponseLod(expandThat[1], 1), raw: text };
  }

  const keepThread = text.match(/^keep\s+this\s+conversation\s+at\s+(?:lod|answer\s*depth)\s*([1-5])(?:\s+unless\s+i\s+expand)?[.!?]*$/i)
    || text.match(/^(?:set\s+)?(?:thread|conversation)\s+default\s+(?:to\s+)?(?:lod|answer\s*depth)\s*([1-5])[.!?]*$/i)
    || text.match(/^use\s+(?:lod|answer\s*depth)\s*([1-5])\s+by\s+default\s+for\s+this\s+(?:thread|conversation)[.!?]*$/i);
  if (keepThread) {
    return { type: 'set_thread_default', response_lod: clampResponseLod(keepThread[1], 1), raw: text };
  }

  const keepSession = text.match(/^use\s+(?:lod|answer\s*depth)\s*([1-5])\s+by\s+default\s+for\s+this\s+code\s*session[.!?]*$/i)
    || text.match(/^(?:set\s+)?code\s*session\s+default\s+(?:to\s+)?(?:lod|answer\s*depth)\s*([1-5])[.!?]*$/i);
  if (keepSession) {
    return { type: 'set_code_session_default', response_lod: clampResponseLod(keepSession[1], 1), raw: text };
  }

  return { type: 'ask', question: text, raw: text };
}

export function isGroundedResponse(r) {
  return Boolean(r && r.schema === GROUNDED_SCHEMA && r.response_id);
}

export function groundedAnswerText(r) {
  if (!r) return '';
  return r.rendered?.text || r.answer || r.skeleton?.conclusion || '';
}

export function evidenceRefCount(r) {
  if (Array.isArray(r?.evidence)) return r.evidence.length;
  const n = Number(r?.telemetry?.evidence_count);
  return Number.isFinite(n) ? n : 0;
}

export function authorityStrip(r) {
  const fresh = r?.authority_freshness || {};
  const stale = fresh.stale === true || fresh.status === 'authority_changed' || fresh.status === 'stale_response';
  const viewedOriginal = fresh.viewed_original_snapshot === true;
  let label = 'Authority: Current ✓';
  let tone = 'current';
  if (stale && viewedOriginal) {
    label = 'Authority: Original snapshot';
    tone = 'original';
  } else if (stale) {
    label = 'Authority: Stale';
    tone = 'stale';
  }
  return {
    label,
    tone,
    stale,
    viewedOriginal,
    status: fresh.status || (stale ? 'authority_changed' : 'current'),
    evidenceCount: evidenceRefCount(r),
    responseLod: clampResponseLod(r?.response_lod ?? r?.rendered?.response_lod, 1),
    responseId: r?.response_id || null,
    acceptedStateAuthority: r?.accepted_state_authority === true
  };
}

export function isStalePayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return payload.error === 'stale_response'
    || payload.reason === 'authority_changed'
    || payload.authority_freshness?.stale === true;
}

export function staleActionsFromPayload(payload) {
  const actions = payload?.actions;
  if (actions && typeof actions === 'object' && !Array.isArray(actions)) {
    return {
      view_original: Boolean(actions.view_original),
      refresh: Boolean(actions.refresh),
      expandParams: actions.view_original?.params || null,
      refreshParams: actions.refresh?.params || null
    };
  }
  const list = Array.isArray(actions) ? actions : (payload?.authority_freshness?.actions || []);
  return {
    view_original: list.includes('view_original'),
    refresh: list.includes('refresh'),
    expandParams: null,
    refreshParams: null
  };
}
