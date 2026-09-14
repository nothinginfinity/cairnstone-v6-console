/**
 * V7.7.9b — Chat contextual config + answer-linked evidence helpers.
 * Presentation only. Never invents a second authority graph.
 * Bound to the same grounded response_id / evidence skeleton from MCP get/expand.
 */

import {
  RESPONSE_LOD_MAX,
  RESPONSE_LOD_MIN,
  authorityStrip,
  clampResponseLod,
  evidenceRefCount,
  isGroundedResponse,
  responseLodLabel
} from './answer-depth.js';

/**
 * Stable Chat-config sheet state for route/model / tool-delegation knobs.
 * Keeps capability honesty for single-chain vs multi-chain Scope.
 */
export function chatConfigState({
  single = false,
  toolDelegate = false,
  scopeResolved = false
} = {}) {
  const routeActive = Boolean(single && toolDelegate);
  const toolDelegateAvailable = Boolean(single);
  let honesty = 'Progressive Answer Depth · cairnstone_grounded_response (default).';
  let routeNote = 'Provider / model apply only to single-chain tool delegation.';

  if (!scopeResolved) {
    honesty = 'Resolving Scope… Chat controls stay visible. Answer Depth is the default path once Scope resolves.';
  } else if (routeActive) {
    honesty = 'Single-chain tool delegation · cairnstone_delegate. Answer Depth LOD controls are inactive on this path.';
    routeNote = 'Route / model / temperature / inbox snapshot apply to cairnstone_delegate only.';
  } else if (single) {
    honesty = 'Progressive Answer Depth · cairnstone_grounded_response on one chain. Optional tool delegation is available below.';
    routeNote = 'Provider / model are inactive until tool delegation is enabled.';
  } else {
    honesty = 'Progressive Answer Depth · cairnstone_grounded_response across the exact multi-chain Scope snapshot. Tool delegation is blocked (multi-chain).';
    routeNote = 'Provider / model stay inspectable but inactive. Multi-chain Chat does not imply cairnstone_delegate.';
  }

  return {
    single: Boolean(single),
    toolDelegate: Boolean(toolDelegate),
    scopeResolved: Boolean(scopeResolved),
    routeActive,
    toolDelegateAvailable,
    routeControlsEnabled: routeActive,
    outputTokensEnabled: true,
    honesty,
    routeNote,
    acceptedStateAuthority: false
  };
}

export function canOpenEvidenceDrawer(r) {
  return isGroundedResponse(r);
}

function claimList(r) {
  const claims = r?.answer_skeleton?.claims || r?.skeleton?.claims || r?.claims;
  return Array.isArray(claims) ? claims : [];
}

function evidenceList(r) {
  return Array.isArray(r?.evidence) ? r.evidence : [];
}

function citationList(r) {
  const cited = r?.cited_stones || r?.citations || r?.rendered?.citations;
  if (Array.isArray(cited) && cited.length) return cited;
  return evidenceList(r).map(x => ({
    chain: x.chain,
    path: x.path,
    stone_hash: x.stone_hash,
    authority_class: x.authority_class,
    commit_sha: x.commit_sha,
    ref_id: x.ref_id
  }));
}

/**
 * Structured model for the answer-linked evidence / provenance / receipt drawer.
 * Uses only fields already present on grounded-response get/expand payloads.
 */
export function evidenceDrawerModel(r) {
  if (!isGroundedResponse(r)) {
    return {
      openable: false,
      responseId: null,
      title: 'No grounded response',
      subtitle: 'Ask first to bind evidence to a response_id.',
      sections: []
    };
  }

  const strip = authorityStrip(r);
  const lod = clampResponseLod(r.response_lod ?? r.rendered?.response_lod, 1);
  const claims = claimList(r);
  const evidence = evidenceList(r);
  const citations = citationList(r);
  const envelope = r.provider_envelope || r.route || {};
  const fresh = r.authority_freshness || {};
  const materialized = Array.isArray(r.materialized_response_lods)
    ? r.materialized_response_lods
    : [lod];

  const sections = [
    {
      id: 'identity',
      title: 'Response identity',
      kind: 'kv',
      rows: [
        ['response_id', r.response_id || '—'],
        ['response_lod', responseLodLabel(lod)],
        ['scope_id', r.scope_id || r.scope_snapshot?.scope_id || '—'],
        ['authority_digest', r.authority_digest || r.scope_snapshot?.authority_digest || '—'],
        ['accepted_state_authority', String(r.accepted_state_authority === true)],
        ['chain_heads_mutated', String(r.chain_heads_mutated ?? false)],
        ['path_heads_mutated', String(r.path_heads_mutated ?? false)]
      ]
    },
    {
      id: 'freshness',
      title: 'Authority freshness',
      kind: 'kv',
      rows: [
        ['status', fresh.status || (strip.stale ? 'authority_changed' : 'current')],
        ['stale', String(strip.stale)],
        ['viewed_original_snapshot', String(Boolean(fresh.viewed_original_snapshot))],
        ['label', strip.label]
      ]
    },
    {
      id: 'citations',
      title: `Citations / evidence (${citations.length || evidenceRefCount(r)})`,
      kind: 'list',
      empty: 'No citation/evidence refs on this payload yet — expand toward Evidence (LOD 3+) or open get with include_evidence.',
      items: citations.map(x => ({
        title: [x.chain || 'chain', x.authority_class].filter(Boolean).join(' · '),
        detail: [x.path || '(evidence)', x.stone_hash, x.commit_sha ? String(x.commit_sha).slice(0, 12) : '', x.ref_id]
          .filter(Boolean)
          .join(' · ')
      }))
    },
    {
      id: 'claims',
      title: `Claim skeleton (${claims.length})`,
      kind: 'list',
      empty: 'No claims on the answer skeleton yet.',
      items: claims.map(x => ({
        title: x.text || x.claim || 'claim',
        detail: [x.stone_hash, x.ref_id, x.authority_class].filter(Boolean).join(' · ')
      }))
    },
    {
      id: 'receipt',
      title: 'Receipt / envelope',
      kind: 'kv',
      rows: [
        ['materialized_response_lods', materialized.join(',') || String(lod)],
        ['provider', envelope.provider || r.provider || '—'],
        ['model', envelope.model || r.model || '—'],
        ['parent_response_id', r.parent_response_id || r.refresh_of || '—'],
        ['telemetry.evidence_count', String(r.telemetry?.evidence_count ?? evidence.length)],
        ['naming', 'response_lod 1→5 · stone_lod unchanged']
      ]
    },
    {
      id: 'depth',
      title: 'Answer Depth (same response_id)',
      kind: 'depth',
      currentLod: lod,
      min: RESPONSE_LOD_MIN,
      max: RESPONSE_LOD_MAX,
      note: 'Expand deeper LODs without regenerating identity. Stale expand fails closed unless View original.'
    }
  ];

  return {
    openable: true,
    responseId: r.response_id,
    title: 'Evidence & provenance',
    subtitle: `${responseLodLabel(lod)} · ${strip.label} · accepted_state_authority false`,
    sections,
    strip,
    evidenceCount: evidenceRefCount(r),
    claimCount: claims.length
  };
}

/**
 * Compact summary line for the grounded result card CTA.
 */
export function evidenceDrawerSummary(r) {
  const model = evidenceDrawerModel(r);
  if (!model.openable) return 'Evidence drawer unavailable until a grounded answer exists.';
  return `${model.evidenceCount} evidence refs · ${model.claimCount} claims · same response_id`;
}
