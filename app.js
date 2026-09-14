import { initInvitePanel } from './invite.js';
import { initCodeSessionPanel } from './code-session.js';
import {
  RESPONSE_LOD_MAX,
  RESPONSE_LOD_MIN,
  authorityStrip,
  clampResponseLod,
  ensureChatThreadId,
  groundedAnswerText,
  isGroundedResponse,
  isStalePayload,
  parseAnswerDepthCommand,
  resolveDefaultDepth,
  responseLodLabel,
  setCodeSessionDefaultDepth,
  setThreadDefaultDepth,
  staleActionsFromPayload
} from './answer-depth.js';
import {
  canOpenEvidenceDrawer,
  chatConfigState,
  evidenceDrawerModel,
  evidenceDrawerSummary
} from './chat-evidence.js';
import {
  commsHubBanner,
  commsListState,
  filterActivityItems,
  groupMessagesByThread,
  handoffChainAllowed,
  normalizeMessageRow,
  sortMessagesNewestFirst
} from './comms-hub.js';
import {
  buildUniverseEntities,
  canZoomIn,
  canZoomOut,
  clampPanZoom,
  focusFromScope,
  layoutSpatialNodes,
  lodLoadPlan,
  normalizeViewMode,
  normalizeZoom,
  panZoomStyle,
  preserveSelection,
  scopeSelectorFromEntity,
  searchToFocus,
  universeSurfaceState,
  zoomIn,
  zoomLabel,
  zoomOut
} from './universe-v2.js';

const DEFAULT_RUNTIME = 'https://cairnstone-v6.jaredtechfit.workers.dev/mcp';
const DEFAULT_CHAIN = 'cairnstone-v6-project-memory';
const MAX_SCOPE_CATALOG_CHAINS = 500;
const MAX_SCOPE_QA_CHAINS = 25;
const CODE_SESSION_STORE_KEY = 'cs.codeSessionId';
const $ = id => document.getElementById(id);

const state = {
  capabilities: [],
  lastResult: null,
  lastStale: null,
  pendingExpandLod: null,
  chatThreadId: null,
  inbox: [],
  activity: [],
  stones: [],
  selectedStone: null,
  authorizations: [],
  selectedAuthorization: null,
  catalog: [],
  scope: { mode: 'single_chain', chains: [DEFAULT_CHAIN], max_chains: 200 },
  scopeSnapshot: null,
  scopeRecents: [],
  universeLod: 'vault',
  universeViewMode: 'spatial',
  universeFocus: { zoom: 'vault', type: 'vault', value: 'All CairnStone', repo: null, chain: null },
  universeSelectionIds: [],
  universeEntities: [],
  universeIntelligence: null,
  universeLoading: false,
  universeError: null,
  universePanZoom: { scale: 1, x: 0, y: 0 },
  universeMultiMode: false,
  universeMultiSelection: new Set()
};

const PRIMARY_BY_PANEL = {
  chat: 'chat',
  code: 'work',
  universe: 'universe',
  inbox: 'inbox',
  handoff: 'inbox',
  activity: 'inbox',
  stones: 'more',
  evidence: 'more',
  authorize: 'more',
  invite: 'more',
  settings: 'more'
};

const DEFAULT_PANEL_BY_PRIMARY = {
  chat: 'chat',
  work: 'code',
  universe: 'universe',
  inbox: 'inbox',
  more: 'stones'
};

const e = {
  runtimeUrl: $('runtimeUrl'), actorId: $('actorId'), healthButton: $('healthButton'), healthDot: $('healthDot'), healthText: $('healthText'),
  contextScopeBtn: $('contextScopeBtn'), contextActorBtn: $('contextActorBtn'), contextSessionBtn: $('contextSessionBtn'), contextRuntimeBtn: $('contextRuntimeBtn'),
  contextScopeLabel: $('contextScopeLabel'), contextActorLabel: $('contextActorLabel'), contextSessionLabel: $('contextSessionLabel'),
  inboxSubnav: $('inboxSubnav'), moreSubnav: $('moreSubnav'),
  inboxGroupThreads: $('inboxGroupThreads'),
  scopeSheet: $('scopeSheet'), runtimeSheet: $('runtimeSheet'), chatConfigSheet: $('chatConfigSheet'), evidenceDrawer: $('evidenceDrawer'),
  settingsOpenSheet: $('settingsOpenSheet'), settingsActorPreview: $('settingsActorPreview'), settingsRuntimePreview: $('settingsRuntimePreview'),
  runtimeSheetRecheck: $('runtimeSheetRecheck'),
  openChatConfig: $('openChatConfig'), openEvidenceDrawer: $('openEvidenceDrawer'),
  chatConfigHonesty: $('chatConfigHonesty'), chatConfigRouteNote: $('chatConfigRouteNote'),
  chatCapabilityHonesty: $('chatCapabilityHonesty'), evidenceDrawerHint: $('evidenceDrawerHint'),
  evidenceDrawerTitle: $('evidenceDrawerTitle'), evidenceDrawerSubtitle: $('evidenceDrawerSubtitle'), evidenceDrawerBody: $('evidenceDrawerBody'),
  scopeSummary: $('scopeSummary'), scopeAuthority: $('scopeAuthority'), scopeCoverage: $('scopeCoverage'), scopeSearch: $('scopeSearch'), scopeAll: $('scopeAll'), scopeDefault: $('scopeDefault'),
  scopeRecentsWrap: $('scopeRecentsWrap'), scopeRecents: $('scopeRecents'), scopeCatalog: $('scopeCatalog'), scopePicker: $('scopePicker'),
  universeLandingSummary: $('universeLandingSummary'), universeLandingAuthority: $('universeLandingAuthority'), universeLandingLod: $('universeLandingLod'),
  universeOpenScope: $('universeOpenScope'), universeOpenRuntime: $('universeOpenRuntime'),
  universeButton: $('universeButton'), universeOverlay: $('universeOverlay'), universeClose: $('universeClose'), universeSearch: $('universeSearch'), universeLod: $('universeLod'),
  universeZoomIn: $('universeZoomIn'), universeZoomOut: $('universeZoomOut'),
  universeViewSpatial: $('universeViewSpatial'), universeViewList: $('universeViewList'), universeViewGrid: $('universeViewGrid'),
  universeMulti: $('universeMulti'), universeApply: $('universeApply'),
  universeStage: $('universeStage'), universeCanvasWrap: $('universeCanvasWrap'), universeCanvas: $('universeCanvas'),
  universeFallback: $('universeFallback'), universeFallbackList: $('universeFallbackList'), universeFallbackLabel: $('universeFallbackLabel'),
  universeGrid: $('universeGrid'), universeStatus: $('universeStatus'),
  universeIntelPanel: $('universeIntelPanel'), universeIntelTitle: $('universeIntelTitle'), universeIntelMeta: $('universeIntelMeta'),
  providerSelect: $('providerSelect'), modelSelect: $('modelSelect'), credentialAliasWrap: $('credentialAliasWrap'), credentialAlias: $('credentialAlias'),
  singleChainRouteControls: $('singleChainRouteControls'), temperatureWrap: $('temperatureWrap'), includeInboxWrap: $('includeInboxWrap'), toolDelegateWrap: $('toolDelegateWrap'), toolDelegate: $('toolDelegate'),
  chatModeNote: $('chatModeNote'), answerDepthDefaults: $('answerDepthDefaults'),
  taskInput: $('taskInput'), outputTokens: $('outputTokens'), temperature: $('temperature'), includeInbox: $('includeInbox'), delegateButton: $('delegateButton'), refreshModels: $('refreshModels'),
  resultTitle: $('resultTitle'), resultMeta: $('resultMeta'), resultText: $('resultText'), copyResult: $('copyResult'),
  authorityStrip: $('authorityStrip'), answerDepthControls: $('answerDepthControls'), staleActions: $('staleActions'),
  authoritySummary: $('authoritySummary'), pathHeads: $('pathHeads'), skillsList: $('skillsList'), memoryRefs: $('memoryRefs'), observability: $('observability'), copyEvidence: $('copyEvidence'),
  inboxActor: $('inboxActor'), refreshInbox: $('refreshInbox'), inboxList: $('inboxList'), messageTitle: $('messageTitle'), messageMeta: $('messageMeta'), messageContent: $('messageContent'),
  handoffChain: $('handoffChain'), handoffTo: $('handoffTo'), handoffSubject: $('handoffSubject'), handoffTask: $('handoffTask'), handoffPackage: $('handoffPackage'), handoffPriority: $('handoffPriority'),
  continuationHash: $('continuationHash'), continuationPath: $('continuationPath'), artifactOwner: $('artifactOwner'), artifactRepo: $('artifactRepo'), artifactPath: $('artifactPath'), artifactCommit: $('artifactCommit'),
  mirrorOwner: $('mirrorOwner'), mirrorRepo: $('mirrorRepo'), mirrorBranch: $('mirrorBranch'), mirrorPrefix: $('mirrorPrefix'), handoffButton: $('handoffButton'), handoffResult: $('handoffResult'),
  activityRefresh: $('activityRefresh'), activityActors: $('activityActors'), activityFilter: $('activityFilter'), activityGroupThreads: $('activityGroupThreads'), activityList: $('activityList'),
  stonesRefresh: $('stonesRefresh'), stonesQuery: $('stonesQuery'), stonesHead: $('stonesHead'), stonesList: $('stonesList'), stoneDetailTitle: $('stoneDetailTitle'), stoneDetailMeta: $('stoneDetailMeta'),
  stoneDetailSummary: $('stoneDetailSummary'), copyStoneHash: $('copyStoneHash'),
  operatorToken: $('operatorToken'), authorizationRefresh: $('authorizationRefresh'), authorizationList: $('authorizationList'), authorizationTitle: $('authorizationTitle'),
  authorizationMeta: $('authorizationMeta'), authorizationSummary: $('authorizationSummary'), authorizationArguments: $('authorizationArguments'), authorizationRaw: $('authorizationRaw'),
  authorizationReject: $('authorizationReject'), authorizationApprove: $('authorizationApprove'), authorizationResult: $('authorizationResult'), toast: $('toast')
};

function normalizeScope(raw) {
  const x = raw && typeof raw === 'object' ? raw : {};
  const mode = ['single_chain', 'repo', 'multi', 'vault'].includes(x.mode) ? x.mode : 'single_chain';
  const out = { mode, max_chains: Math.min(MAX_SCOPE_CATALOG_CHAINS, Math.max(1, Number(x.max_chains || 200))) };
  if (mode === 'single_chain') out.chains = [String((x.chains || [DEFAULT_CHAIN])[0] || DEFAULT_CHAIN)];
  if (mode === 'multi') {
    out.chains = [...new Set((Array.isArray(x.chains) ? x.chains : []).map(String).map(s => s.trim()).filter(Boolean))].sort();
    if (!out.chains.length) return { mode: 'single_chain', chains: [DEFAULT_CHAIN], max_chains: 200 };
  }
  if (mode === 'repo') {
    out.repos = [...new Set((Array.isArray(x.repos) ? x.repos : []).map(String).map(s => s.trim()).filter(Boolean))].sort();
    if (!out.repos.length) return { mode: 'single_chain', chains: [DEFAULT_CHAIN], max_chains: 200 };
  }
  return out;
}

function scopeArgs() {
  return structuredClone(normalizeScope(state.scope));
}

function scopeKey(scope = state.scope) {
  return JSON.stringify(normalizeScope(scope));
}

function currentCodeSessionId() {
  try { return String(sessionStorage.getItem(CODE_SESSION_STORE_KEY) || '').trim(); } catch { return ''; }
}

function presentationDefaultDepth() {
  return resolveDefaultDepth({
    threadId: state.chatThreadId || ensureChatThreadId(),
    codeSessionId: currentCodeSessionId()
  });
}

function renderAnswerDepthDefaults() {
  if (!e.answerDepthDefaults) return;
  const threadId = state.chatThreadId || ensureChatThreadId();
  const codeSessionId = currentCodeSessionId();
  const depth = presentationDefaultDepth();
  const bits = [`Default Answer Depth: ${responseLodLabel(depth)} (presentation only)`];
  if (codeSessionId) bits.push(`Code Session ${short(codeSessionId)}`);
  else bits.push(`Thread ${short(threadId)}`);
  bits.push('Never accepted project authority · distinct from stone_lod');
  e.answerDepthDefaults.textContent = bits.join(' · ');
}

function loadSettings() {
  e.runtimeUrl.value = localStorage.getItem('cs.runtime') || DEFAULT_RUNTIME;
  e.actorId.value = localStorage.getItem('cs.actor') || 'console:jared';
  e.inboxActor.value = localStorage.getItem('cs.inboxActor') || e.actorId.value;
  e.activityActors.value = localStorage.getItem('cs.activityActors') || e.actorId.value;
  e.operatorToken.value = sessionStorage.getItem('cs.operatorToken') || '';
  state.chatThreadId = ensureChatThreadId();
  if (e.toolDelegate) e.toolDelegate.checked = localStorage.getItem('cs.chat.toolDelegate.v1') === '1';

  const priorChain = localStorage.getItem('cs.chain') || DEFAULT_CHAIN;
  try {
    state.scope = normalizeScope(JSON.parse(localStorage.getItem('cs.scope.v1') || 'null') || { mode: 'single_chain', chains: [priorChain] });
  } catch {
    state.scope = { mode: 'single_chain', chains: [priorChain], max_chains: 200 };
  }
  try {
    const recents = JSON.parse(localStorage.getItem('cs.scope.recents.v1') || '[]');
    state.scopeRecents = Array.isArray(recents) ? recents.filter(x => x && x.scope && x.label).slice(0, 6) : [];
  } catch {
    state.scopeRecents = [];
  }
  renderAnswerDepthDefaults();
}

function saveSettings() {
  localStorage.setItem('cs.runtime', e.runtimeUrl.value.trim());
  localStorage.setItem('cs.actor', e.actorId.value.trim());
  localStorage.setItem('cs.inboxActor', e.inboxActor.value.trim());
  localStorage.setItem('cs.activityActors', e.activityActors.value.trim());
  localStorage.setItem('cs.scope.v1', JSON.stringify(normalizeScope(state.scope)));
  if (state.scope.mode === 'single_chain' && state.scope.chains?.[0]) localStorage.setItem('cs.chain', state.scope.chains[0]);
  if (e.toolDelegate) localStorage.setItem('cs.chat.toolDelegate.v1', e.toolDelegate.checked ? '1' : '0');
}

async function mcpCall(name, args = {}) {
  saveSettings();
  const r = await fetch(e.runtimeUrl.value.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: 'tools/call', params: { name, arguments: args } })
  });
  if (!r.ok) throw new Error(`MCP HTTP ${r.status}`);
  const rpc = await r.json();
  if (rpc.error) throw new Error(rpc.error.message || 'MCP JSON-RPC error');
  const text = rpc?.result?.content?.find(x => x.type === 'text')?.text;
  if (typeof text !== 'string') throw new Error('MCP result did not include a text payload');
  const out = JSON.parse(text);
  if (out?.ok === false) {
    const err = new Error(out.error || 'CairnStone tool failed');
    err.payload = out;
    throw err;
  }
  return out;
}

function runtimeBase() {
  return e.runtimeUrl.value.trim().replace(/\/mcp\/?$/, '');
}

async function operatorCall(path, { method = 'GET', body } = {}) {
  const token = e.operatorToken.value.trim();
  if (!token) throw new Error('Enter the operator token first');
  sessionStorage.setItem('cs.operatorToken', token);
  const headers = { 'Accept': 'application/json', 'Authorization': `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(`${runtimeBase()}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let out;
  try { out = await r.json(); } catch { throw new Error(`Authorization HTTP ${r.status}`); }
  if (!r.ok || out?.ok === false) {
    const err = new Error(out?.error || `Authorization HTTP ${r.status}`);
    err.payload = out;
    throw err;
  }
  return out;
}

async function health() {
  setHealth('checking');
  try {
    const r = await mcpCall('cairnstone_health', {});
    setHealth('ok', `${r.version || 'live'} · ${r.mcp_tools?.length || 0} tools`);
    return r;
  } catch (err) {
    setHealth('bad', 'Offline');
    toast(err.message);
    throw err;
  }
}

function setHealth(status, text = 'Checking…') {
  e.healthDot.className = `dot ${status === 'ok' ? 'ok' : status === 'bad' ? 'bad' : ''}`;
  e.healthText.textContent = text;
}

async function loadVaultCatalog() {
  e.scopeCatalog.innerHTML = '<p class="muted">Loading catalog…</p>';
  const rows = [];
  let after;
  for (let page = 0; page < 3 && rows.length < MAX_SCOPE_CATALOG_CHAINS; page += 1) {
    const args = { limit: 200 };
    if (after) args.after_chain = after;
    const r = await mcpCall('cairnstone_vault_catalog', args);
    rows.push(...(r.chains || []));
    if (!r.has_more || !r.next_after_chain) break;
    after = r.next_after_chain;
  }
  state.catalog = rows.slice(0, MAX_SCOPE_CATALOG_CHAINS);
  renderScopeRecents();
  renderScopeCatalog();
  await resolveCurrentScope({ recordRecent: false });
}

function catalogRecord(chain) {
  return state.catalog.find(x => x.chain === chain) || null;
}

function catalogReposForChains(chains) {
  const repos = new Set();
  for (const chain of chains) for (const repo of (catalogRecord(chain)?.repos || [])) if (repo) repos.add(repo);
  return [...repos].sort();
}

function repoGroups(query = '') {
  const q = query.trim().toLowerCase();
  const map = new Map();
  for (const row of state.catalog) {
    const matchesChain = row.chain.toLowerCase().includes(q);
    const repos = row.repos?.length ? row.repos : ['(no repository provenance)'];
    for (const repo of repos) {
      const matchesRepo = repo.toLowerCase().includes(q);
      if (q && !matchesChain && !matchesRepo) continue;
      if (!map.has(repo)) map.set(repo, []);
      map.get(repo).push(row);
    }
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([repo, chains]) => [repo, chains.sort((a, b) => a.chain.localeCompare(b.chain))]);
}

function renderScopeCatalog() {
  const groups = repoGroups(e.scopeSearch.value);
  if (!groups.length) {
    e.scopeCatalog.innerHTML = '<p class="muted">No matching repositories or chains.</p>';
    return;
  }
  const selected = new Set(state.scope.chains || []);
  e.scopeCatalog.innerHTML = groups.map(([repo, chains]) => {
    const repoSelectable = repo !== '(no repository provenance)';
    const repoActive = state.scope.mode === 'repo' && (state.scope.repos || []).includes(repo);
    const chainRows = chains.map(row => {
      const active = selected.has(row.chain);
      return `<button class="chain-row ${active ? 'active' : ''} ${row.canonical_head ? '' : 'headless'}" type="button" data-chain="${esc(row.chain)}">
        <input tabindex="-1" type="checkbox" ${active ? 'checked' : ''} aria-hidden="true">
        <span><strong>${esc(row.chain)}</strong><div class="meta">${row.canonical_head ? `HEAD ${esc(short(row.canonical_head))}` : 'No canonical HEAD'} · ${row.stone_count} stones · ${row.path_head_count} path HEADs</div></span>
      </button>`;
    }).join('');
    return `<div class="repo-group">
      <button class="repo-row ${repoActive ? 'active' : ''}" type="button" data-repo="${repoSelectable ? esc(repo) : ''}" ${repoSelectable ? '' : 'disabled'}>
        <span><strong>${esc(repo)}</strong><div class="meta">${chains.length} visible chain${chains.length === 1 ? '' : 's'}</div></span>
        <span aria-hidden="true">${repoSelectable ? '›' : '—'}</span>
      </button>
      <div class="chain-list">${chainRows}</div>
    </div>`;
  }).join('');
  e.scopeCatalog.querySelectorAll('[data-chain]').forEach(b => b.addEventListener('click', () => toggleChainInScope(b.dataset.chain)));
  e.scopeCatalog.querySelectorAll('[data-repo]').forEach(b => {
    if (!b.dataset.repo) return;
    b.addEventListener('click', () => setScope({ mode: 'repo', repos: [b.dataset.repo], max_chains: 200 }, `Repo · ${b.dataset.repo}`));
  });
}

function scopeLabel(scope = state.scope, snapshot = state.scopeSnapshot) {
  const s = normalizeScope(scope);
  if (s.mode === 'vault') return 'All CairnStone';
  if (s.mode === 'repo') return s.repos.length === 1 ? `Repo · ${s.repos[0]}` : `${s.repos.length} repos`;
  if (s.mode === 'single_chain') return s.chains[0];
  const n = snapshot?.chains?.length ?? s.chains.length;
  return `${n} chains`;
}

function addScopeRecent(label, scope) {
  const key = scopeKey(scope);
  state.scopeRecents = [{ label, scope: normalizeScope(scope) }, ...state.scopeRecents.filter(x => scopeKey(x.scope) !== key)].slice(0, 6);
  localStorage.setItem('cs.scope.recents.v1', JSON.stringify(state.scopeRecents));
  renderScopeRecents();
}

function renderScopeRecents() {
  e.scopeRecentsWrap.classList.toggle('hidden', !state.scopeRecents.length);
  e.scopeRecents.innerHTML = state.scopeRecents.map((x, i) => `<button class="chip scope-recent-button" type="button" data-recent="${i}">${esc(x.label)}</button>`).join('');
  e.scopeRecents.querySelectorAll('[data-recent]').forEach(b => b.addEventListener('click', () => {
    const x = state.scopeRecents[Number(b.dataset.recent)];
    if (x) setScope(x.scope, x.label, { recordRecent: false });
  }));
}

async function setScope(scope, label, { recordRecent = true } = {}) {
  state.scope = normalizeScope(scope);
  saveSettings();
  renderScopeCatalog();
  await resolveCurrentScope({ recordRecent, recentLabel: label });
  if (!e.universeOverlay.classList.contains('hidden')) renderUniverse().catch(() => {});
}

async function toggleChainInScope(chain) {
  const selected = new Set(state.scope.mode === 'multi' || state.scope.mode === 'single_chain' ? (state.scope.chains || []) : []);
  if (selected.has(chain)) selected.delete(chain); else selected.add(chain);
  const chains = [...selected].sort();
  if (!chains.length) return setScope({ mode: 'single_chain', chains: [DEFAULT_CHAIN] }, DEFAULT_CHAIN);
  if (chains.length === 1) return setScope({ mode: 'single_chain', chains, max_chains: 200 }, chains[0]);
  return setScope({ mode: 'multi', chains, max_chains: 200 }, `${chains.length} chains`);
}

async function resolveCurrentScope({ recordRecent = false, recentLabel } = {}) {
  e.scopeSummary.textContent = 'Resolving Scope…';
  e.scopeAuthority.textContent = 'Reading exact participating chain HEAD snapshot.';
  syncContextBar({ scopePending: true });
  try {
    const snap = await mcpCall('cairnstone_resolve_scope', scopeArgs());
    state.scopeSnapshot = snap;
    const chains = snap.chains || [];
    const repos = state.scope.mode === 'repo' ? [...(state.scope.repos || [])] : catalogReposForChains(chains.map(x => x.chain));
    e.scopeSummary.textContent = `${repos.length} repo${repos.length === 1 ? '' : 's'} · ${chains.length} chain${chains.length === 1 ? '' : 's'}`;
    e.scopeAuthority.textContent = `Scope ${short(snap.scope_id)} · authority ${short(snap.authority_digest)} · ${scopeLabel()}`;
    const diagnostics = [];
    if (snap.truncated) diagnostics.push('Scope is truncated by its explicit max_chains bound.');
    const headless = chains.filter(x => !x.head_hash);
    if (headless.length) diagnostics.push(`${headless.length} participating chain${headless.length === 1 ? '' : 's'} currently lack a canonical HEAD.`);
    if (state.scope.mode !== 'single_chain' && chains.length > MAX_SCOPE_QA_CHAINS) diagnostics.push(`Grounded cross-chain Q&A is limited to ${MAX_SCOPE_QA_CHAINS} chains; narrow Scope before asking.`);
    e.scopeCoverage.textContent = diagnostics.join(' ');
    if (recordRecent) addScopeRecent(recentLabel || scopeLabel(), state.scope);
    updateScopeDependents();
    renderScopeCatalog();
    renderEvidence(state.lastResult);
    syncContextBar();
    return snap;
  } catch (err) {
    state.scopeSnapshot = null;
    e.scopeSummary.textContent = 'Scope unavailable';
    e.scopeAuthority.textContent = err.message;
    e.scopeCoverage.textContent = '';
    updateScopeDependents();
    syncContextBar();
    toast(err.message);
    throw err;
  }
}

function updateScopeDependents() {
  const chains = state.scopeSnapshot?.chains || [];
  const previous = e.handoffChain.value;
  e.handoffChain.innerHTML = chains.map(x => `<option value="${esc(x.chain)}">${esc(x.chain)}${x.head_hash ? '' : ' · no HEAD'}</option>`).join('');
  if (chains.some(x => x.chain === previous)) e.handoffChain.value = previous;
  e.handoffButton.disabled = !chains.length;
  renderChatMode();
}

function renderChatMode() {
  const scopeResolved = Boolean(state.scopeSnapshot);
  const single = state.scope.mode === 'single_chain' && (!scopeResolved || (state.scopeSnapshot?.chains?.length || 0) === 1);
  const toolDelegateWanted = Boolean(e.toolDelegate?.checked);
  const toolDelegate = Boolean(single && toolDelegateWanted);
  const cfg = chatConfigState({ single, toolDelegate, scopeResolved });

  // Route/model knobs live in Chat config sheet — first paint prioritizes Ask + depth.
  // Keep controls mounted (visible+disabled when inactive) for spatial stability.
  if (e.singleChainRouteControls) e.singleChainRouteControls.classList.remove('hidden');
  if (e.temperatureWrap) e.temperatureWrap.classList.remove('hidden');
  if (e.includeInboxWrap) e.includeInboxWrap.classList.remove('hidden');
  if (e.refreshModels) e.refreshModels.classList.remove('hidden');
  if (e.toolDelegateWrap) {
    e.toolDelegateWrap.classList.remove('hidden');
    e.toolDelegateWrap.classList.toggle('blocked', !cfg.toolDelegateAvailable);
    if (e.toolDelegate) e.toolDelegate.disabled = !cfg.toolDelegateAvailable;
  }

  [e.providerSelect, e.modelSelect, e.credentialAlias, e.temperature, e.includeInbox].forEach(control => {
    if (control) control.disabled = !cfg.routeControlsEnabled;
  });
  if (e.outputTokens) e.outputTokens.disabled = false;
  if (e.refreshModels) e.refreshModels.disabled = false;

  const chain = state.scopeSnapshot?.chains?.[0]?.chain || state.scope.chains?.[0] || DEFAULT_CHAIN;
  const n = state.scopeSnapshot?.chains?.length || 0;
  if (e.chatModeNote) {
    if (!scopeResolved) {
      e.chatModeNote.textContent = 'Resolving Scope… Ask + Answer Depth stay ready; Chat config holds route/model knobs.';
    } else if (cfg.routeActive) {
      e.chatModeNote.textContent = `Tool delegation · cairnstone_delegate on ${chain}. Answer Depth LOD inactive on this path.`;
    } else if (single) {
      e.chatModeNote.textContent = `Answer Depth · cairnstone_grounded_response on ${chain} (LOD 1→5, same response_id). Distinct from stone_lod.`;
    } else {
      e.chatModeNote.textContent = `Answer Depth · cairnstone_grounded_response across ${n}-chain Scope. Tool delegation blocked for multi-chain. accepted_state_authority false.`;
    }
  }
  if (e.chatCapabilityHonesty) {
    e.chatCapabilityHonesty.textContent = cfg.toolDelegateAvailable
      ? 'Single-chain Scope: optional tool delegation available via checkbox (and Chat config).'
      : 'Multi-chain / vault Scope: cairnstone_delegate is blocked — grounded Answer Depth only.';
  }
  if (e.chatConfigHonesty) e.chatConfigHonesty.textContent = cfg.honesty;
  if (e.chatConfigRouteNote) e.chatConfigRouteNote.textContent = cfg.routeNote;
  renderAnswerDepthDefaults();
  syncEvidenceDrawerCta();
}

async function loadCapabilities() {
  busy(e.refreshModels, true, 'Loading…');
  try {
    const r = await mcpCall('cairnstone_model_capabilities', {});
    state.capabilities = (r.models || []).filter(m => m.status === 'available' && !m.provider.startsWith('mock-'));
    renderProviders();
  } catch (err) {
    toast(err.message);
  } finally {
    busy(e.refreshModels, false, 'Refresh models');
    renderChatMode();
  }
}

function renderProviders() {
  const current = e.providerSelect.value;
  const providers = [...new Set(state.capabilities.map(m => m.provider))];
  e.providerSelect.innerHTML = providers.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  if (providers.includes(current)) e.providerSelect.value = current;
  renderModels();
}

function renderModels() {
  const provider = e.providerSelect.value;
  const models = state.capabilities.filter(m => m.provider === provider);
  e.modelSelect.innerHTML = models.map(m => `<option value="${esc(m.model)}">${esc(m.model)}</option>`).join('');
  e.credentialAliasWrap.classList.toggle('hidden', provider === 'workers-ai' || provider.startsWith('mock-'));
}

function route() {
  const provider = e.providerSelect.value;
  const r = { provider, model: e.modelSelect.value };
  if (provider === 'workers-ai') r.credential_mode = 'workers_ai_billing';
  else if (!provider.startsWith('mock-')) {
    r.credential_mode = 'byok';
    r.credential_alias = e.credentialAlias.value.trim() || 'default';
  }
  return r;
}

async function askCurrentScope() {
  const task = e.taskInput.value.trim();
  if (!task) return toast('Enter a question or task first');
  if (!state.scopeSnapshot) return toast('Resolve Scope first');

  const command = parseAnswerDepthCommand(task);
  if (command.type === 'set_thread_default') {
    const tid = state.chatThreadId || ensureChatThreadId();
    setThreadDefaultDepth(tid, command.response_lod);
    renderAnswerDepthDefaults();
    e.taskInput.value = '';
    toast(`Thread default Answer Depth set to LOD ${command.response_lod} (presentation only)`);
    return;
  }
  if (command.type === 'set_code_session_default') {
    const sid = currentCodeSessionId();
    if (!sid) return toast('Load a Code Session ID first (Code tab), then set its default Answer Depth');
    setCodeSessionDefaultDepth(sid, command.response_lod);
    renderAnswerDepthDefaults();
    e.taskInput.value = '';
    toast(`Code Session default Answer Depth set to LOD ${command.response_lod} (presentation only)`);
    return;
  }
  if (command.type === 'expand') {
    if (!isGroundedResponse(state.lastResult)) return toast('No grounded response to expand — ask first');
    e.taskInput.value = '';
    return expandGroundedResponse(command.response_lod, { viewOriginal: false }).catch(() => {});
  }

  const single = state.scope.mode === 'single_chain' && (state.scopeSnapshot.chains?.length || 0) === 1;
  const useToolDelegate = Boolean(single && e.toolDelegate?.checked);

  busy(e.delegateButton, true, 'Asking…');
  e.resultTitle.textContent = 'Working…';
  e.resultText.textContent = 'Resolving accepted authority and grounded evidence.';
  clearAnswerDepthUi();
  try {
    let r;
    if (useToolDelegate) {
      r = await mcpCall('cairnstone_delegate', {
        actor_id: e.actorId.value.trim(),
        task: command.question || task,
        chain: state.scopeSnapshot.chains[0].chain,
        route: route(),
        generation: { max_output_tokens: Number(e.outputTokens.value || 800), temperature: Number(e.temperature.value || 0.2) },
        include_inbox: e.includeInbox.checked
      });
      e.handoffPackage.value = r.package_id || '';
      e.continuationHash.value = r.evidence?.chain_head?.hash || r.evidence?.chain_head?.stone_hash || '';
      state.lastStale = null;
      state.lastResult = r;
      renderResult(r);
      renderEvidence(r);
      toast('Delegated answer complete');
    } else {
      r = await createGroundedResponse(command.question || task, { responseLod: 1 });
      e.handoffPackage.value = '';
      e.continuationHash.value = '';
      state.lastStale = null;
      state.lastResult = r;
      renderResult(r);
      renderEvidence(r);
      const preferred = presentationDefaultDepth();
      if (preferred > 1) {
        await expandGroundedResponse(preferred, { viewOriginal: false, quiet: true });
      }
      toast('Grounded answer complete');
    }
  } catch (err) {
    const p = err.payload || {};
    state.lastResult = p?.ok === false && isGroundedResponse(p) ? p : (isGroundedResponse(state.lastResult) ? state.lastResult : null);
    if (isStalePayload(p)) {
      state.lastStale = p;
      renderStaleActions(p);
      e.resultTitle.textContent = 'Stale response';
      e.resultText.textContent = p.detail || 'Accepted authority moved. View original snapshot or Refresh answer.';
    } else {
      state.lastStale = null;
      e.resultTitle.textContent = p.error || 'Request failed';
      e.resultMeta.innerHTML = '';
      e.resultText.textContent = p.detail || p.hint || err.message;
      clearAnswerDepthUi({ keepStale: false });
    }
    renderEvidence(p);
    toast(err.message);
  } finally {
    busy(e.delegateButton, false, 'Ask current Scope');
  }
}

async function createGroundedResponse(question, { responseLod = 1, refreshOf = null } = {}) {
  const chains = state.scopeSnapshot?.chains || [];
  if (chains.length > MAX_SCOPE_QA_CHAINS) throw new Error(`Current Scope resolves to ${chains.length} chains; grounded-response accepts at most ${MAX_SCOPE_QA_CHAINS}. Narrow Scope first.`);
  const headless = chains.find(x => !x.head_hash);
  if (headless) throw new Error(`Current Scope includes ${headless.chain}, which has no canonical HEAD. Narrow Scope before grounded synthesis.`);

  const args = {
    question,
    scope: scopeArgs(),
    response_lod: clampResponseLod(responseLod, 1),
    actor_id: e.actorId.value.trim(),
    thread_id: state.chatThreadId || ensureChatThreadId(),
    max_tokens: Number(e.outputTokens.value || 800)
  };
  const codeSessionId = currentCodeSessionId();
  if (codeSessionId) args.code_session_id = codeSessionId;
  if (refreshOf) args.refresh_of = refreshOf;
  return mcpCall('cairnstone_grounded_response', args);
}

async function expandGroundedResponse(targetLod, { viewOriginal = false, quiet = false } = {}) {
  const lod = clampResponseLod(targetLod, 1);
  const current = state.lastResult;
  if (!isGroundedResponse(current)) return toast('No grounded response to expand');

  state.pendingExpandLod = lod;
  renderAnswerDepthControls(current);
  if (!quiet) {
    busy(e.delegateButton, true, `LOD ${lod}…`);
  }
  try {
    let r;
    if (lod === clampResponseLod(current.response_lod ?? current.rendered?.response_lod, 1) && !viewOriginal) {
      r = await mcpCall('cairnstone_grounded_response_get', {
        response_id: current.response_id,
        include_skeleton: true,
        include_evidence: true
      });
    } else {
      r = await mcpCall('cairnstone_grounded_response_expand', {
        response_id: current.response_id,
        response_lod: lod,
        view_original: Boolean(viewOriginal),
        include_skeleton: true,
        include_evidence: true
      });
    }
    state.lastResult = r;
    state.lastStale = null;
    renderResult(r);
    renderEvidence(r);
    if (!quiet) toast(viewOriginal ? `Viewing original snapshot at LOD ${lod}` : `Answer Depth LOD ${lod}`);
  } catch (err) {
    const p = err.payload || {};
    if (isStalePayload(p)) {
      state.lastStale = p;
      renderStaleActions(p, lod);
      if (!quiet) toast('Authority changed — choose View original or Refresh');
    } else if (!quiet) {
      toast(err.message);
    }
  } finally {
    state.pendingExpandLod = null;
    renderAnswerDepthControls(state.lastResult);
    if (!quiet) busy(e.delegateButton, false, 'Ask current Scope');
  }
}

async function refreshGroundedAnswer() {
  const prior = state.lastResult;
  const stale = state.lastStale;
  const question = stale?.actions?.refresh?.params?.question || prior?.question;
  if (!question) return toast('Nothing to refresh');
  const refreshOf = stale?.actions?.refresh?.params?.refresh_of || prior?.response_id;
  busy(e.delegateButton, true, 'Refreshing…');
  e.resultTitle.textContent = 'Refreshing…';
  e.resultText.textContent = 'Creating a new grounded response against current accepted authority (new response_id).';
  try {
    const r = await createGroundedResponse(question, { responseLod: 1, refreshOf });
    state.lastResult = r;
    state.lastStale = null;
    renderResult(r);
    renderEvidence(r);
    toast('Refreshed answer (new response_id)');
  } catch (err) {
    e.resultTitle.textContent = err.payload?.error || 'Refresh failed';
    e.resultText.textContent = err.payload?.detail || err.message;
    toast(err.message);
  } finally {
    busy(e.delegateButton, false, 'Ask current Scope');
  }
}

function clearAnswerDepthUi({ keepStale = false } = {}) {
  if (e.authorityStrip) {
    e.authorityStrip.classList.add('hidden');
    e.authorityStrip.innerHTML = '';
  }
  if (e.answerDepthControls) {
    e.answerDepthControls.classList.add('hidden');
    e.answerDepthControls.innerHTML = '';
  }
  if (!keepStale && e.staleActions) {
    e.staleActions.classList.add('hidden');
    e.staleActions.innerHTML = '';
  }
  syncEvidenceDrawerCta();
}

function syncEvidenceDrawerCta(r = state.lastResult) {
  const openable = canOpenEvidenceDrawer(r);
  if (e.openEvidenceDrawer) e.openEvidenceDrawer.disabled = !openable;
  if (e.evidenceDrawerHint) {
    if (openable) {
      e.evidenceDrawerHint.classList.remove('hidden');
      e.evidenceDrawerHint.textContent = evidenceDrawerSummary(r);
    } else {
      e.evidenceDrawerHint.classList.add('hidden');
      e.evidenceDrawerHint.textContent = '';
    }
  }
}

function renderEvidenceDrawerBody(r = state.lastResult) {
  const model = evidenceDrawerModel(r);
  if (e.evidenceDrawerTitle) e.evidenceDrawerTitle.textContent = model.title;
  if (e.evidenceDrawerSubtitle) e.evidenceDrawerSubtitle.textContent = model.subtitle;
  if (!e.evidenceDrawerBody) return;
  if (!model.openable) {
    e.evidenceDrawerBody.innerHTML = `<p class="muted">${esc(model.subtitle)}</p>`;
    return;
  }

  e.evidenceDrawerBody.innerHTML = model.sections.map(section => {
    if (section.kind === 'kv') {
      return `<section class="evidence-drawer-section">
        <h3>${esc(section.title)}</h3>
        <div class="evidence-grid">${section.rows.map(([k, v]) => evidenceCell([k, v])).join('')}</div>
      </section>`;
    }
    if (section.kind === 'list') {
      const body = section.items.length
        ? `<div class="list">${section.items.map(item => `<div class="list-item"><strong>${esc(item.title)}</strong><br>${esc(item.detail || '')}</div>`).join('')}</div>`
        : `<p class="muted small">${esc(section.empty || 'None')}</p>`;
      return `<section class="evidence-drawer-section"><h3>${esc(section.title)}</h3>${body}</section>`;
    }
    if (section.kind === 'depth') {
      const buttons = [];
      for (let lod = section.min; lod <= section.max; lod += 1) {
        const active = lod === section.currentLod ? 'active' : '';
        buttons.push(`<button type="button" class="lod-btn ${active}" data-drawer-lod="${lod}" title="${esc(responseLodLabel(lod))}">${lod === 1 ? 'LOD 1' : lod}</button>`);
      }
      return `<section class="evidence-drawer-section">
        <h3>${esc(section.title)}</h3>
        <p class="muted small">${esc(section.note)}</p>
        <div class="answer-depth-controls drawer-depth-controls">${buttons.join('')}</div>
        <div class="invite-actions">
          <button type="button" class="secondary" data-drawer-action="more-evidence">Open Evidence explorer</button>
        </div>
      </section>`;
    }
    return '';
  }).join('');

  e.evidenceDrawerBody.querySelectorAll('[data-drawer-lod]').forEach(btn => {
    btn.addEventListener('click', () => {
      const lod = Number(btn.dataset.drawerLod);
      const fresh = r.authority_freshness || {};
      const stale = fresh.stale === true;
      closeSheet('evidenceDrawer');
      expandGroundedResponse(lod, { viewOriginal: stale && fresh.viewed_original_snapshot === true }).catch(() => {});
    });
  });
  e.evidenceDrawerBody.querySelectorAll('[data-drawer-action="more-evidence"]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeSheet('evidenceDrawer');
      panel('evidence');
    });
  });
}

function openEvidenceDrawerForResult() {
  if (!canOpenEvidenceDrawer(state.lastResult)) return toast('Ask for a grounded answer first');
  renderEvidenceDrawerBody(state.lastResult);
  openSheet('evidenceDrawer');
}

function renderAuthorityStrip(r) {
  if (!e.authorityStrip) return;
  if (!isGroundedResponse(r)) {
    e.authorityStrip.classList.add('hidden');
    e.authorityStrip.innerHTML = '';
    return;
  }
  const strip = authorityStrip(r);
  e.authorityStrip.classList.remove('hidden');
  e.authorityStrip.innerHTML = [
    `<span class="authority-pill ${esc(strip.tone)}">${esc(strip.label)}</span>`,
    `<span class="evidence-pill">Evidence: ${esc(String(strip.evidenceCount))} refs</span>`,
    `<span class="evidence-pill">response_id ${esc(short(strip.responseId))}</span>`,
    strip.acceptedStateAuthority ? '<span class="evidence-pill">accepted_state_authority true</span>' : '<span class="evidence-pill">accepted_state_authority false</span>'
  ].join('');
}

function renderAnswerDepthControls(r) {
  if (!e.answerDepthControls) return;
  if (!isGroundedResponse(r)) {
    e.answerDepthControls.classList.add('hidden');
    e.answerDepthControls.innerHTML = '';
    return;
  }
  const current = clampResponseLod(r.response_lod ?? r.rendered?.response_lod, 1);
  const pending = state.pendingExpandLod;
  const buttons = [];
  for (let lod = RESPONSE_LOD_MIN; lod <= RESPONSE_LOD_MAX; lod += 1) {
    const active = lod === current ? 'active' : '';
    const disabled = pending != null ? 'disabled' : '';
    const label = lod === 1 ? 'LOD 1' : String(lod);
    buttons.push(`<button type="button" class="lod-btn ${active}" data-response-lod="${lod}" ${disabled} title="${esc(responseLodLabel(lod))}">${esc(label)}</button>`);
  }
  e.answerDepthControls.classList.remove('hidden');
  e.answerDepthControls.innerHTML = `<span class="answer-depth-label">${esc(responseLodLabel(current))}</span>${buttons.join('')}`;
  e.answerDepthControls.querySelectorAll('[data-response-lod]').forEach(btn => {
    btn.addEventListener('click', () => {
      const lod = Number(btn.dataset.responseLod);
      const fresh = r.authority_freshness || {};
      const stale = fresh.stale === true;
      expandGroundedResponse(lod, { viewOriginal: stale && fresh.viewed_original_snapshot === true }).catch(() => {});
    });
  });
}

function renderStaleActions(payload, requestedLod = null) {
  if (!e.staleActions) return;
  const actions = staleActionsFromPayload(payload);
  const lod = clampResponseLod(requestedLod || payload?.actions?.view_original?.params?.response_lod || state.pendingExpandLod || 2, 2);
  e.staleActions.classList.remove('hidden');
  e.staleActions.innerHTML = `
    <p><strong>Stale response</strong> — accepted authority moved (${esc(payload?.reason || payload?.authority_freshness?.status || 'authority_changed')}). Expanding deeper LODs will not silently mix snapshots.</p>
    <div class="stale-buttons">
      ${actions.view_original ? `<button type="button" class="secondary" data-stale-action="view_original">View original snapshot</button>` : ''}
      ${actions.refresh ? `<button type="button" class="secondary" data-stale-action="refresh">Refresh answer</button>` : ''}
    </div>`;
  e.staleActions.querySelectorAll('[data-stale-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.staleAction === 'view_original') {
        expandGroundedResponse(lod, { viewOriginal: true }).catch(() => {});
      } else if (btn.dataset.staleAction === 'refresh') {
        refreshGroundedAnswer().catch(() => {});
      }
    });
  });
}

function renderResult(r) {
  if (isGroundedResponse(r)) {
    const lod = clampResponseLod(r.response_lod ?? r.rendered?.response_lod, 1);
    e.resultTitle.textContent = `Answer Depth · ${responseLodLabel(lod)}`;
    e.resultText.classList.remove('muted');
    e.resultText.textContent = groundedAnswerText(r) || '(No answer returned)';
    e.resultMeta.innerHTML = [
      ['response', short(r.response_id)],
      ['scope', short(r.scope_id || r.scope_snapshot?.scope_id)],
      ['authority', short(r.authority_digest)],
      ['response_lod', String(lod)],
      ['materialized', (r.materialized_response_lods || []).join(',') || String(lod)]
    ].map(([k, v]) => chip(`${k}: ${v}`)).join('');
    renderAuthorityStrip(r);
    renderAnswerDepthControls(r);
    if (authorityStrip(r).stale && !authorityStrip(r).viewedOriginal) {
      renderStaleActions({
        error: 'stale_response',
        reason: r.authority_freshness?.status || 'authority_changed',
        actions: r.authority_freshness?.actions || ['view_original', 'refresh'],
        response_id: r.response_id,
        question: r.question
      }, lod);
    } else if (e.staleActions) {
      e.staleActions.classList.add('hidden');
      e.staleActions.innerHTML = '';
    }
    syncEvidenceDrawerCta(r);
  } else if (r?.schema === 'cairnstone-scope-answer-v1') {
    clearAnswerDepthUi();
    e.resultTitle.textContent = `Scope Q&A · ${r.model || 'Workers AI'}`;
    e.resultText.textContent = r.answer || '(No answer returned)';
    e.resultMeta.innerHTML = [
      ['scope', short(r.scope_snapshot?.scope_id)],
      ['chains', String(r.scope_snapshot?.chains?.length || 0)],
      ['cited', String(r.cited_stones?.length || 0)],
      ['citations', r.citation_validation?.ok === true ? 'validated' : 'unknown'],
      ['coverage', r.coverage?.complete === true ? 'complete' : 'bounded']
    ].map(([k, v]) => chip(`${k}: ${v}`)).join('');
    syncEvidenceDrawerCta(null);
  } else {
    clearAnswerDepthUi();
    e.resultTitle.textContent = `${r.route?.provider || 'model'} · ${r.route?.model || 'unknown'}`;
    e.resultText.textContent = r.output?.text || '(No text returned)';
    e.resultMeta.innerHTML = [
      ['package', short(r.package_id)],
      ['request', short(r.request_ir_id)],
      ['input', tok(r.usage?.input_tokens)],
      ['output', tok(r.usage?.output_tokens)],
      ['tools', String(r.policy?.tools_executed ?? 0)]
    ].map(([k, v]) => chip(`${k}: ${v}`)).join('');
    syncEvidenceDrawerCta(null);
  }
  e.copyResult.disabled = false;
}

function renderEvidence(r) {
  const snap = r?.scope_snapshot || state.scopeSnapshot;
  if (isGroundedResponse(r)) {
    const fresh = r.authority_freshness || {};
    e.authoritySummary.innerHTML = [
      ['Schema', r.schema || '—'],
      ['response_id', r.response_id || '—'],
      ['response_lod', String(r.response_lod ?? r.rendered?.response_lod ?? '—')],
      ['Scope ID', r.scope_id || snap?.scope_id || '—'],
      ['Authority digest', r.authority_digest || snap?.authority_digest || '—'],
      ['Authority freshness', fresh.status || (fresh.stale ? 'stale' : 'current')],
      ['Evidence refs', String(Array.isArray(r.evidence) ? r.evidence.length : (r.telemetry?.evidence_count ?? 0))],
      ['accepted_state_authority', String(r.accepted_state_authority ?? false)],
      ['Chain HEAD writes', String(r.chain_heads_mutated ?? false)],
      ['Path HEAD writes', String(r.path_heads_mutated ?? false)],
      ['Naming', 'response_lod 1→5 answer depth · stone_lod unchanged']
    ].map(evidenceCell).join('');
    list(e.pathHeads, r.evidence, x => `<strong>${esc(x.chain || 'chain')} · ${esc(x.authority_class || '')}</strong><br>${esc(x.path || '(evidence)')} · ${esc(short(x.stone_hash))}${x.commit_sha ? ` · ${esc(x.commit_sha.slice(0, 12))}` : ''}`);
    list(e.skillsList, [], () => '');
    list(e.memoryRefs, r.answer_skeleton?.claims || r.skeleton?.claims || [], x => `<strong>${esc(x.text || 'claim')}</strong><br>${esc(short(x.stone_hash))}${x.ref_id ? ` · ${esc(x.ref_id)}` : ''}`);
    e.observability.textContent = JSON.stringify({
      response_id: r.response_id,
      naming: r.naming,
      authority_freshness: r.authority_freshness,
      telemetry: r.telemetry,
      materialized_response_lods: r.materialized_response_lods,
      provider_envelope: r.provider_envelope,
      accepted_state_authority: r.accepted_state_authority,
      chain_heads_mutated: r.chain_heads_mutated,
      path_heads_mutated: r.path_heads_mutated
    }, null, 2);
  } else if (r?.schema === 'cairnstone-scope-answer-v1') {
    e.authoritySummary.innerHTML = [
      ['Scope ID', snap?.scope_id || '—'],
      ['Authority digest', snap?.authority_digest || '—'],
      ['Participating chains', String(snap?.chains?.length || 0)],
      ['Model', r.model || '—'],
      ['Citation validation', String(r.citation_validation?.ok ?? false)],
      ['Persistence', r.persistence === null ? 'none' : String(r.persistence)],
      ['Chain HEAD writes', String(r.read_only?.chain_heads_written ?? false)],
      ['Stone writes', String(r.read_only?.stones_written ?? false)]
    ].map(evidenceCell).join('');
    list(e.pathHeads, r.evidence, x => `<strong>${esc(x.chain || 'chain')} · ${esc(x.authority_class || '')}</strong><br>${esc(x.path || '(orientation)')} · ${esc(short(x.stone_hash))}${x.commit_sha ? ` · ${esc(x.commit_sha.slice(0, 12))}` : ''}`);
    list(e.skillsList, [], () => '');
    list(e.memoryRefs, [], () => '');
    e.observability.textContent = JSON.stringify({ scope_snapshot: snap, coverage: r.coverage, citation_validation: r.citation_validation, read_only: r.read_only }, null, 2);
  } else {
    const ev = r?.evidence || {}, p = r?.policy || {}, d = r?.diagnostics || {}, head = ev.chain_head || {};
    e.authoritySummary.innerHTML = [
      ['Scope ID', snap?.scope_id || '—'],
      ['Scope authority', snap?.authority_digest || '—'],
      ['Package ID', r?.package_id || '—'],
      ['Request IR', r?.request_ir_id || '—'],
      ['Canonical HEAD', head.hash || head.stone_hash || snap?.chains?.[0]?.head_hash || '—'],
      ['Provider / model', [r?.route?.provider, r?.route?.model].filter(Boolean).join(' / ') || '—'],
      ['Execution authority', String(p.execution_authority ?? false)],
      ['Mutation authority', String(p.mutation_authority ?? false)]
    ].map(evidenceCell).join('');
    list(e.pathHeads, ev.path_heads, x => `<strong>${esc(x.path || 'unknown')}</strong><br>${esc(short(x.stone_hash))}${x.commit_sha ? ` · ${esc(x.commit_sha.slice(0, 12))}` : ''}`);
    list(e.skillsList, ev.selected_skills, x => `<strong>${esc(x.skill_id || 'skill')}</strong> ${esc(x.skill_version || '')}<br>${esc(short(x.stone_hash))}`);
    list(e.memoryRefs, ev.memory_refs, x => `<strong>${esc(x.path || x.ref_id || 'memory')}</strong><br>${esc(short(x.stone_hash))}${x.ref_id ? ` · ${esc(x.ref_id)}` : ''}`);
    e.observability.textContent = JSON.stringify(r?.observability || { scope_snapshot: snap, diagnostics: d }, null, 2);
  }
  e.copyEvidence.disabled = !r && !state.scopeSnapshot;
}

function evidenceCell([label, value]) {
  return `<div class="evidence-item"><span class="muted small">${esc(label)}</span><strong>${esc(String(value))}</strong></div>`;
}

async function refreshInbox() {
  const recipient = e.inboxActor.value.trim();
  if (!recipient) return toast('Enter an inbox actor ID');
  busy(e.refreshInbox, true, 'Loading…');
  const loading = commsListState({ loading: true, surface: 'inbox' });
  e.inboxList.innerHTML = `<p class="muted">${esc(loading.message)}</p>`;
  try {
    const r = await mcpCall('cairnstone_get_inbox', { recipient_id: recipient, limit: 100 });
    state.inbox = r.messages || [];
    renderInbox();
    toast(`${state.inbox.length} messages`);
  } catch (err) {
    const st = commsListState({ error: err, surface: 'inbox' });
    e.inboxList.innerHTML = `<p class="muted">${esc(st.message)}</p>`;
    toast(err.message);
  } finally {
    busy(e.refreshInbox, false, 'Refresh');
  }
}

function messageRowHtml(row) {
  const unread = row.unread ? '● ' : '';
  const recipient = row.recipient_id ? `to ${esc(row.recipient_id)} · ` : '';
  return `<div class="message-row-head"><span class="comms-intent-badge" data-intent="${esc(row.intent)}">${esc(row.intentLabel)}</span><strong>${unread}${esc(row.subject)}</strong></div><div class="meta">${recipient}from ${esc(row.sender_id)} · ${esc(row.priority)} · ${esc(row.status || '')}</div><div class="meta">${esc(short(row.stone_hash))}${row.message_id ? ` · ${esc(short(row.message_id))}` : ''}</div>`;
}

function renderInbox() {
  const empty = commsListState({ count: state.inbox.length, surface: 'inbox' });
  if (empty.status === 'empty') {
    e.inboxList.innerHTML = `<p class="muted">${esc(empty.message)}</p>`;
    return;
  }
  e.inboxList.innerHTML = '';
  const items = sortMessagesNewestFirst(state.inbox);
  const appendRow = (m) => {
    const row = normalizeMessageRow(m, { surface: 'inbox' });
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'message-item';
    b.innerHTML = messageRowHtml(row);
    b.addEventListener('click', () => readMessage(m));
    e.inboxList.append(b);
  };
  if (e.inboxGroupThreads?.checked) {
    for (const group of groupMessagesByThread(items)) {
      const h = document.createElement('div');
      h.className = 'list-item thread-group';
      h.innerHTML = `<strong>${esc(group.thread_id)}</strong><div class="meta">${group.count} message${group.count === 1 ? '' : 's'} · presentation grouping only</div>`;
      e.inboxList.append(h);
      group.messages.forEach(appendRow);
    }
  } else {
    items.forEach(appendRow);
  }
}

async function readMessage(m) {
  e.messageTitle.textContent = 'Loading…';
  try {
    const r = await mcpCall('cairnstone_read_message', { recipient_id: e.inboxActor.value.trim(), message_id: m.message_id });
    e.messageTitle.textContent = r.metadata?.subject || m.subject || 'Message';
    e.messageMeta.innerHTML = [['from', r.metadata?.from || m.sender_id], ['intent', r.metadata?.intent || m.intent], ['thread', r.thread_id], ['message_id', m.message_id], ['stone', short(r.stone_hash)], ['scope', r.mutation_scope], ['exec_authority', 'none']].map(([k, v]) => chip(`${k}: ${v || '—'}`)).join('');
    e.messageContent.textContent = pretty(r.content);
    await refreshInbox();
  } catch (err) {
    e.messageTitle.textContent = 'Read failed';
    e.messageContent.textContent = err.message;
  }
}

async function handoff() {
  const to = e.handoffTo.value.split(',').map(v => v.trim()).filter(Boolean);
  const task = e.handoffTask.value.trim();
  const chain = e.handoffChain.value.trim();
  if (!chain || !to.length || !task) return toast('Associated chain, recipients, and task are required');
  if (!handoffChainAllowed(chain, state.scopeSnapshot?.chains || [])) {
    return toast('Handoff chain must be an exact participating chain in the current Scope');
  }

  const a = {
    from: e.actorId.value.trim(),
    to,
    task,
    chain,
    subject: e.handoffSubject.value.trim() || 'CairnStone V7 handoff',
    priority: e.handoffPriority.value
  };
  if (e.handoffPackage.value.trim()) a.package_id = e.handoffPackage.value.trim();
  if (e.continuationHash.value.trim()) a.continuation_refs = [{ stone_hash: e.continuationHash.value.trim(), path: e.continuationPath.value.trim() || undefined }];

  const artifact = [e.artifactOwner.value.trim(), e.artifactRepo.value.trim(), e.artifactPath.value.trim(), e.artifactCommit.value.trim()];
  if (artifact.some(Boolean)) {
    if (!artifact.every(Boolean)) return toast('Complete all GitHub artifact fields or leave them blank');
    a.github_artifact = { owner: artifact[0], repo: artifact[1], path: artifact[2], commit_sha: artifact[3] };
  }

  const mirror = [e.mirrorOwner.value.trim(), e.mirrorRepo.value.trim(), e.mirrorBranch.value.trim(), e.mirrorPrefix.value.trim()];
  if (mirror.some(Boolean)) {
    if (!mirror[0] || !mirror[1]) return toast('GitHub inbox mirror requires owner and repo');
    a.github_inbox = { owner: mirror[0], repo: mirror[1] };
    if (mirror[2]) a.github_inbox.branch = mirror[2];
    if (mirror[3]) a.github_inbox.path_prefix = mirror[3];
  }

  busy(e.handoffButton, true, 'Dispatching…');
  try {
    const r = await mcpCall('cairnstone_dispatch_handoff', a);
    e.handoffResult.textContent = JSON.stringify(r, null, 2);
    const m = r.github_inbox_mirror;
    if (m) toast(m.ok ? (m.artifacts?.[0]?.idempotent_replay ? 'Handoff + GitHub mirror replayed' : 'Handoff dispatched · GitHub mirror written') : 'Handoff dispatched · GitHub mirror failed in isolation');
    else toast(r.idempotent_replay ? 'Handoff replayed idempotently' : 'Handoff dispatched');
  } catch (err) {
    e.handoffResult.textContent = JSON.stringify(err.payload || { error: err.message }, null, 2);
    toast(err.message);
  } finally {
    busy(e.handoffButton, false, 'Dispatch handoff');
  }
}

async function refreshActivity() {
  const actors = (e.activityActors.value || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!actors.length) actors.push(e.actorId.value.trim());
  busy(e.activityRefresh, true, 'Loading…');
  const loading = commsListState({ loading: true, surface: 'activity' });
  e.activityList.innerHTML = `<p class="muted">${esc(loading.message)}</p>`;
  try {
    const results = await Promise.all(actors.map(async actor => {
      try {
        const r = await mcpCall('cairnstone_get_inbox', { recipient_id: actor, limit: 50 });
        return (r.messages || []).map(m => ({ ...m, for: actor }));
      } catch {
        return [];
      }
    }));
    state.activity = results.flat();
    renderActivity();
    toast(`${state.activity.length} activity item${state.activity.length === 1 ? '' : 's'} across ${actors.length} actor${actors.length === 1 ? '' : 's'}`);
  } catch (err) {
    const st = commsListState({ error: err, surface: 'activity' });
    e.activityList.innerHTML = `<p class="muted">${esc(st.message)}</p>`;
    toast(err.message);
  } finally {
    busy(e.activityRefresh, false, 'Refresh');
  }
}

function renderActivity() {
  let items = filterActivityItems(state.activity || [], e.activityFilter.value);
  items = sortMessagesNewestFirst(items);
  const empty = commsListState({ count: items.length, surface: 'activity' });
  if (empty.status === 'empty') {
    e.activityList.innerHTML = `<p class="muted">${esc(empty.message)}</p>`;
    return;
  }
  e.activityList.innerHTML = '';
  if (e.activityGroupThreads.checked) {
    for (const group of groupMessagesByThread(items)) {
      const h = document.createElement('div');
      h.className = 'list-item thread-group';
      h.innerHTML = `<strong>${esc(group.thread_id)}</strong><div class="meta">${group.count} message${group.count === 1 ? '' : 's'} · presentation grouping only</div>`;
      e.activityList.append(h);
      group.messages.forEach(m => e.activityList.append(activityItemEl(m)));
    }
  } else {
    items.forEach(m => e.activityList.append(activityItemEl(m)));
  }
}

function activityItemEl(m) {
  const row = normalizeMessageRow(m, { surface: 'activity' });
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'message-item';
  b.innerHTML = messageRowHtml(row);
  b.addEventListener('click', () => readActivityMessage(m));
  return b;
}

async function readActivityMessage(m) {
  e.inboxActor.value = m.for || m.recipient_id || e.inboxActor.value;
  await readMessage(m);
  panel('inbox');
  await refreshActivity();
}

async function refreshStones() {
  if (!state.scopeSnapshot) return toast('Resolve Scope first');
  busy(e.stonesRefresh, true, 'Loading…');
  try {
    const query = e.stonesQuery.value.trim();
    if (state.scope.mode === 'single_chain' && state.scopeSnapshot.chains?.length === 1) {
      const chain = state.scopeSnapshot.chains[0].chain;
      const r = await mcpCall('cairnstone_list_stones', { chain, q: query || undefined, limit: 40 });
      state.stones = (r.stones || []).map(s => ({ ...s, kind: 'stone' }));
      e.stonesHead.innerHTML = [chip(`${r.total ?? state.stones.length} stones in ${chain}`), ...(state.stones.some(s => s.is_head) ? [chip(`HEAD: ${short(state.stones.find(s => s.is_head).hash)}`)] : [])].join('');
    } else if (query) {
      const r = await mcpCall('cairnstone_find_scope', {
        query,
        scope: scopeArgs(),
        top_k: 40,
        per_chain_k: 5,
        max_total_candidates: 200,
        expand: false
      });
      state.stones = (r.matches || []).map(m => ({ ...m, kind: 'scope_match' }));
      e.stonesHead.innerHTML = [
        chip(`${r.total ?? state.stones.length} matches`),
        chip(`${r.coverage?.queried_chain_count ?? state.scopeSnapshot.chains.length} chains queried`),
        chip(r.coverage?.complete === true ? 'coverage: complete' : 'coverage: bounded')
      ].join('');
    } else {
      state.stones = (state.scopeSnapshot.chains || []).map(x => ({ ...x, catalog: catalogRecord(x.chain), kind: 'chain_overview' }));
      e.stonesHead.innerHTML = [chip(`${state.stones.length} participating chains`), chip(`Scope: ${short(state.scopeSnapshot.scope_id)}`)].join('');
    }
    renderStones();
    toast(`${state.stones.length} item${state.stones.length === 1 ? '' : 's'} loaded`);
  } catch (err) {
    e.stonesList.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    toast(err.message);
  } finally {
    busy(e.stonesRefresh, false, 'Refresh');
  }
}

function renderStones() {
  const xs = state.stones || [];
  if (!xs.length) {
    e.stonesList.innerHTML = '<p class="muted">No stones or matches found.</p>';
    return;
  }
  e.stonesList.innerHTML = '';
  xs.forEach(s => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'message-item';
    if (s.kind === 'chain_overview') {
      b.innerHTML = `<strong>${s.head_hash ? '★ ' : ''}${esc(s.chain)}</strong><div class="meta">${esc((s.catalog?.repos || []).join(', ') || 'no repo provenance')} · ${s.catalog?.stone_count ?? '—'} stones · ${s.catalog?.path_head_count ?? '—'} path HEADs</div><div class="meta">HEAD ${esc(short(s.head_hash))}</div>`;
      b.addEventListener('click', () => setScope({ mode: 'single_chain', chains: [s.chain], max_chains: 200 }, s.chain));
    } else if (s.kind === 'scope_match') {
      b.innerHTML = `<strong>${esc(s.chain)} · ${esc(s.authority_class || '')}</strong><div class="meta">${esc(s.path || '')}${s.commit_sha ? ` · ${esc(s.commit_sha.slice(0, 10))}` : ''}</div><div class="meta">${esc(short(s.stone_hash))} · ${esc(s.preview || '')}</div>`;
      b.addEventListener('click', () => selectStone(s));
    } else {
      b.innerHTML = `<strong>${s.is_head ? '★ ' : ''}${esc(s.title || '(untitled)')}</strong><div class="meta">${esc(s.path || '')}${s.commit ? ` · ${esc(s.commit.slice(0, 10))}` : ''}</div><div class="meta">${esc(short(s.hash))} · ${esc(s.author || '')}</div>`;
      b.addEventListener('click', () => selectStone(s));
    }
    e.stonesList.append(b);
  });
}

function selectStone(s) {
  state.selectedStone = s;
  const hash = s.hash || s.stone_hash;
  if (s.kind === 'scope_match') {
    e.stoneDetailTitle.textContent = `${s.chain} · ${s.authority_class || 'evidence'}`;
    e.stoneDetailMeta.innerHTML = [['Path', s.path || '—'], ['Repo', s.repo || '—'], ['Commit', s.commit_sha ? s.commit_sha.slice(0, 12) : '—'], ['Authority', s.authority_class || '—'], ['Ref', s.ref_id || '—']].map(([k, v]) => chip(`${k}: ${v}`)).join('');
    e.stoneDetailSummary.textContent = s.preview || 'No preview returned.';
  } else {
    e.stoneDetailTitle.textContent = s.title || '(untitled)';
    e.stoneDetailMeta.innerHTML = [['Path', s.path || '—'], ['Repo', s.repo || '—'], ['Commit', s.commit ? s.commit.slice(0, 12) : '—'], ['HEAD', s.is_head ? 'yes' : 'no'], ['Author', s.author || '—'], ['Created', s.created_at ? new Date(s.created_at).toLocaleString() : '—']].map(([k, v]) => chip(`${k}: ${v}`)).join('');
    e.stoneDetailSummary.textContent = `LOD5: ${s.lod5 || '—'}\n\nLOD4: ${s.lod4 || '—'}`;
  }
  e.copyStoneHash.disabled = !hash;
}

function primaryRepoGroups() {
  const map = new Map();
  for (const row of state.catalog) {
    const repo = row.repos?.[0] || '(no repository provenance)';
    if (!map.has(repo)) map.set(repo, []);
    map.get(repo).push(row);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([repo, chains]) => [repo, chains.sort((a, b) => a.chain.localeCompare(b.chain))]);
}

function openUniverse() {
  state.universeMultiMode = false;
  state.universeMultiSelection = new Set(state.scope.mode === 'multi' || state.scope.mode === 'single_chain' ? (state.scope.chains || []) : []);
  state.universeFocus = focusFromScope(state.scope, state.scopeSnapshot);
  state.universeLod = normalizeZoom(state.universeFocus.zoom || 'vault');
  state.universeViewMode = 'spatial';
  state.universePanZoom = { scale: 1, x: 0, y: 0 };
  state.universeIntelligence = null;
  state.universeError = null;
  e.universeOverlay.classList.remove('hidden');
  e.universeSearch.value = '';
  renderUniverse().catch(err => toast(err.message));
  e.universeSearch.focus();
}

function closeUniverse() {
  e.universeOverlay.classList.add('hidden');
}

async function renderUniverse() {
  e.universeOverlay.classList.toggle('universe-multi-on', state.universeMultiMode);
  e.universeLod.textContent = `LOD: ${zoomLabel(state.universeLod)}`;
  e.universeZoomIn.disabled = !canZoomIn(state.universeLod);
  e.universeZoomOut.disabled = !canZoomOut(state.universeLod);
  e.universeApply.disabled = !state.universeMultiMode || !state.universeMultiSelection.size;
  [e.universeViewSpatial, e.universeViewList, e.universeViewGrid].forEach(btn => {
    if (!btn) return;
    btn.classList.toggle('active', btn.dataset.view === state.universeViewMode);
  });
  if (e.universeStage) e.universeStage.dataset.view = state.universeViewMode;
  if (e.universeFallbackLabel) e.universeFallbackLabel.textContent = state.universeViewMode === 'list' ? 'List view' : 'List fallback';

  await ensureUniverseLodData();
  const raw = buildUniverseEntities({
    catalog: state.catalog,
    zoom: state.universeLod,
    focus: state.universeFocus,
    intelligence: state.universeIntelligence
  });
  const focused = searchToFocus(raw, e.universeSearch?.value || '');
  state.universeSelectionIds = preserveSelection(state.universeSelectionIds, focused);
  state.universeEntities = focused;

  const surface = universeSurfaceState({
    loaded: Boolean(state.catalog?.length) || Boolean(state.universeIntelligence),
    loading: state.universeLoading,
    error: state.universeError,
    entityCount: focused.length,
    zoom: state.universeLod
  });
  if (e.universeStatus) {
    e.universeStatus.dataset.status = surface.status;
    e.universeStatus.textContent = `${surface.title} — ${surface.body}`;
  }

  renderUniverseCanvas();
  renderUniverseFallback();
  renderUniverseGrid();
  renderUniverseIntelPanel();
  syncUniverseLanding();
}

async function ensureUniverseLodData() {
  const plan = lodLoadPlan({ zoom: state.universeLod, focus: state.universeFocus });
  if (!plan.intelligenceChain) {
    state.universeIntelligence = null;
    return;
  }
  if (state.universeIntelligence?.chain === plan.intelligenceChain && state.universeIntelligence?.ok) return;
  state.universeLoading = true;
  state.universeError = null;
  if (e.universeStatus) {
    e.universeStatus.dataset.status = 'loading';
    e.universeStatus.textContent = 'Loading bounded Intelligence LOD…';
  }
  try {
    let card = null;
    try {
      card = await mcpCall('cairnstone_resume_chain', plan.resumeArgs);
    } catch {
      card = await mcpCall('cairnstone_manifest_v2', plan.manifestArgs);
    }
    state.universeIntelligence = { ...(card || {}), chain: plan.intelligenceChain, ok: Boolean(card?.ok !== false) };
  } catch (err) {
    state.universeError = err;
    state.universeIntelligence = null;
  } finally {
    state.universeLoading = false;
  }
}

function selectorActive(type, value) {
  if (type === 'vault') return state.scope.mode === 'vault';
  if (type === 'repo') return state.scope.mode === 'repo' && (state.scope.repos || []).includes(value);
  if (type === 'intelligence') return false;
  return (state.scope.mode === 'single_chain' || state.scope.mode === 'multi') && (state.scope.chains || []).includes(value);
}

function applyUniversePanZoom() {
  if (!e.universeCanvas) return;
  const t = clampPanZoom(state.universePanZoom);
  e.universeCanvas.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
  e.universeCanvas.style.transformOrigin = 'center center';
}

function renderUniverseCanvas() {
  const nodes = layoutSpatialNodes(state.universeEntities, { zoom: state.universeLod });
  e.universeCanvas.innerHTML = nodes.map(n => {
    const active = selectorActive(n.type, n.value) || state.universeSelectionIds.includes(n.id);
    const multi = n.type === 'chain' && state.universeMultiSelection.has(n.value);
    const size = n.size ? `size-${n.size}` : '';
    return `<button class="universe-node ${n.type} ${size} ${active ? 'active' : ''} ${multi ? 'multi-selected' : ''} ${n.focused ? 'focused' : ''} ${n.dimmed ? 'dim' : ''}" type="button" data-uid="${esc(n.id)}" data-utype="${esc(n.type)}" data-uvalue="${esc(n.value)}" title="${esc(n.meta || n.label)}" style="left:${Number(n.x) || 50}%;top:${Number(n.y) || 50}%">${esc(n.label)}${n.headless ? ' · no HEAD' : ''}</button>`;
  }).join('');
  e.universeCanvas.querySelectorAll('[data-utype]').forEach(b => b.addEventListener('click', event => {
    event.stopPropagation();
    universeEntityAction(b.dataset.utype, b.dataset.uvalue, b.dataset.uid);
  }));
  applyUniversePanZoom();
}

function renderUniverseFallback() {
  const entities = state.universeEntities;
  const selected = state.universeMultiSelection;
  if (!entities.length) {
    e.universeFallbackList.innerHTML = '<p class="muted">No entities at this LOD.</p>';
    return;
  }
  e.universeFallbackList.innerHTML = entities.map(n => {
    const active = selectorActive(n.type, n.value) || state.universeSelectionIds.includes(n.id);
    const multi = n.type === 'chain' && selected.has(n.value);
    return `<button class="universe-entity-row ${active ? 'active' : ''} ${n.focused ? 'focused' : ''} ${n.dimmed ? 'dim' : ''}" type="button" data-uid="${esc(n.id)}" data-utype="${esc(n.type)}" data-uvalue="${esc(n.value)}">
      <span><strong>${esc(n.label)}</strong><div class="meta">${esc(n.type)} · ${esc(n.meta || '')}${multi ? ' · multi' : ''}</div></span>
      <span>›</span>
    </button>`;
  }).join('');
  e.universeFallbackList.querySelectorAll('[data-utype]').forEach(b => b.addEventListener('click', () => universeEntityAction(b.dataset.utype, b.dataset.uvalue, b.dataset.uid)));
}

function renderUniverseGrid() {
  if (!e.universeGrid) return;
  const entities = state.universeEntities;
  if (!entities.length) {
    e.universeGrid.innerHTML = '<p class="muted">No entities at this LOD.</p>';
    return;
  }
  e.universeGrid.innerHTML = entities.map(n => {
    const active = selectorActive(n.type, n.value) || state.universeSelectionIds.includes(n.id);
    return `<button class="universe-grid-card ${active ? 'active' : ''} ${n.focused ? 'focused' : ''} ${n.dimmed ? 'dim' : ''}" type="button" data-uid="${esc(n.id)}" data-utype="${esc(n.type)}" data-uvalue="${esc(n.value)}">
      <strong>${esc(n.label)}</strong>
      <span class="meta">${esc(n.type)} · ${esc(n.meta || '')}</span>
    </button>`;
  }).join('');
  e.universeGrid.querySelectorAll('[data-utype]').forEach(b => b.addEventListener('click', () => universeEntityAction(b.dataset.utype, b.dataset.uvalue, b.dataset.uid)));
}

function renderUniverseIntelPanel() {
  if (!e.universeIntelPanel) return;
  const show = state.universeLod === 'intelligence';
  e.universeIntelPanel.classList.toggle('hidden', !show);
  if (!show) return;
  const card = state.universeIntelligence?.start_here || state.universeIntelligence?.canonical_head || null;
  const chain = state.universeFocus?.chain || state.universeIntelligence?.chain || '—';
  if (state.universeLoading) {
    e.universeIntelTitle.textContent = `Loading ${chain}…`;
    e.universeIntelMeta.textContent = 'Bounded resume_chain detail=start_here (fallback: manifest_v2 orientation).';
    return;
  }
  if (state.universeError) {
    e.universeIntelTitle.textContent = 'Intelligence LOD failed';
    e.universeIntelMeta.textContent = String(state.universeError.message || state.universeError);
    return;
  }
  if (!card) {
    e.universeIntelTitle.textContent = chain;
    e.universeIntelMeta.textContent = 'No orientation card returned. Scope snapshot remains worker-authoritative.';
    return;
  }
  e.universeIntelTitle.textContent = card.title || chain;
  const bits = [
    card.path || state.universeIntelligence?.provenance?.path || null,
    card.stone_hash || card.hash ? short(card.stone_hash || card.hash) : null,
    state.universeIntelligence?.authority?.mode || null
  ].filter(Boolean);
  e.universeIntelMeta.textContent = `${bits.join(' · ')} · presentation only`;
}

async function universeEntityAction(type, value, id) {
  const entity = state.universeEntities.find(x => x.id === id) || { type, value, id: id || `${type}:${value}` };
  state.universeSelectionIds = preserveSelection([entity.id], state.universeEntities);
  if (!state.universeSelectionIds.includes(entity.id)) state.universeSelectionIds = [entity.id];

  const mapped = scopeSelectorFromEntity(entity, {
    multiMode: state.universeMultiMode,
    multiSelection: state.universeMultiSelection
  });

  if (mapped?.multiToggle) {
    if (state.universeMultiSelection.has(mapped.multiToggle)) state.universeMultiSelection.delete(mapped.multiToggle);
    else state.universeMultiSelection.add(mapped.multiToggle);
    await renderUniverse();
    return;
  }

  if (type === 'repo') {
    state.universeFocus = { zoom: 'repo', type: 'repo', value, repo: value, chain: null };
    state.universeLod = 'repo';
    state.universeIntelligence = null;
    await renderUniverse();
    if (!state.universeMultiMode) await setScope({ mode: 'repo', repos: [value], max_chains: 200 }, `Repo · ${value}`);
    return;
  }

  if (type === 'chain') {
    const row = catalogRecord(value);
    const repo = row?.repos?.[0] || state.universeFocus?.repo || null;
    state.universeFocus = { zoom: 'chain', type: 'chain', value, repo, chain: value };
    if (state.universeLod === 'vault' || state.universeLod === 'repo') state.universeLod = 'chain';
    state.universeIntelligence = null;
    await renderUniverse();
    if (!state.universeMultiMode) await setScope({ mode: 'single_chain', chains: [value], max_chains: 200 }, value);
    return;
  }

  if (type === 'vault') {
    state.universeFocus = { zoom: 'vault', type: 'vault', value: 'All CairnStone', repo: null, chain: null };
    state.universeLod = 'vault';
    state.universeIntelligence = null;
    await renderUniverse();
    await setScope({ mode: 'vault', max_chains: 200 }, 'All CairnStone');
    return;
  }

  if (type === 'intelligence') {
    // Focus only — never invent Scope/HEAD from orientation presentation.
    state.universeLod = 'intelligence';
    await renderUniverse();
    return;
  }

  if (mapped?.mode && !mapped.keepScope) {
    await setScope(
      { mode: mapped.mode, chains: mapped.chains, repos: mapped.repos, max_chains: mapped.max_chains || 200 },
      mapped.label
    );
  }
}

async function setUniverseZoom(next) {
  const priorIds = state.universeEntities.map(x => x.id);
  state.universeLod = normalizeZoom(next);
  if (state.universeLod === 'intelligence') {
    const chain = state.universeFocus?.chain
      || state.universeEntities.find(x => x.type === 'chain' && (x.focusedHost || state.universeSelectionIds.includes(x.id)))?.value
      || state.scope.chains?.[0]
      || state.catalog[0]?.chain
      || null;
    if (!chain) {
      toast('Select a chain before Intelligence LOD');
      state.universeLod = 'chain';
    } else {
      const row = catalogRecord(chain);
      state.universeFocus = {
        zoom: 'intelligence',
        type: 'chain',
        value: chain,
        repo: row?.repos?.[0] || state.universeFocus?.repo || null,
        chain
      };
      state.universeIntelligence = null;
    }
  } else if (state.universeLod === 'repo' && !state.universeFocus?.repo) {
    const repoEnt = state.universeEntities.find(x => x.type === 'repo' && state.universeSelectionIds.includes(x.id))
      || state.universeEntities.find(x => x.type === 'repo');
    if (repoEnt) state.universeFocus = { zoom: 'repo', type: 'repo', value: repoEnt.value, repo: repoEnt.value, chain: state.universeFocus?.chain || null };
  } else if (state.universeLod === 'vault') {
    state.universeFocus = { ...state.universeFocus, zoom: 'vault', type: 'vault', value: 'All CairnStone' };
    state.universeIntelligence = null;
  }
  await renderUniverse();
  state.universeSelectionIds = preserveSelection(state.universeSelectionIds.length ? state.universeSelectionIds : priorIds, state.universeEntities);
  await renderUniverse();
}

function setUniverseViewMode(mode) {
  state.universeViewMode = normalizeViewMode(mode);
  renderUniverse().catch(err => toast(err.message));
}

function focusUniverseSearch() {
  state.universeEntities = searchToFocus(
    buildUniverseEntities({
      catalog: state.catalog,
      zoom: state.universeLod,
      focus: state.universeFocus,
      intelligence: state.universeIntelligence
    }),
    e.universeSearch?.value || ''
  );
  renderUniverseCanvas();
  renderUniverseFallback();
  renderUniverseGrid();
}

async function applyUniverseMulti() {
  const chains = [...state.universeMultiSelection].sort();
  if (!chains.length) return toast('Select at least one chain');
  if (chains.length === 1) await setScope({ mode: 'single_chain', chains, max_chains: 200 }, chains[0]);
  else await setScope({ mode: 'multi', chains, max_chains: 200 }, `${chains.length} chains`);
}

function bindUniversePanZoom() {
  const wrap = e.universeCanvasWrap;
  if (!wrap || wrap.dataset.panBound === '1') return;
  wrap.dataset.panBound = '1';
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const onDown = ev => {
    if (ev.target.closest?.('.universe-node')) return;
    dragging = true;
    const pt = ev.touches?.[0] || ev;
    lastX = pt.clientX;
    lastY = pt.clientY;
  };
  const onMove = ev => {
    if (!dragging) return;
    const pt = ev.touches?.[0] || ev;
    const dx = pt.clientX - lastX;
    const dy = pt.clientY - lastY;
    lastX = pt.clientX;
    lastY = pt.clientY;
    state.universePanZoom = clampPanZoom({
      ...state.universePanZoom,
      x: state.universePanZoom.x + dx,
      y: state.universePanZoom.y + dy
    });
    applyUniversePanZoom();
    if (ev.cancelable) ev.preventDefault();
  };
  const onUp = () => { dragging = false; };
  wrap.addEventListener('pointerdown', onDown);
  wrap.addEventListener('pointermove', onMove);
  wrap.addEventListener('pointerup', onUp);
  wrap.addEventListener('pointercancel', onUp);
  wrap.addEventListener('pointerleave', onUp);
  wrap.addEventListener('wheel', ev => {
    ev.preventDefault();
    const next = state.universePanZoom.scale * (ev.deltaY < 0 ? 1.08 : 0.92);
    state.universePanZoom = clampPanZoom({ ...state.universePanZoom, scale: next });
    applyUniversePanZoom();
  }, { passive: false });
}

async function refreshAuthorizations() {
  busy(e.authorizationRefresh, true, 'Loading…');
  try {
    const r = await operatorCall('/v1/tool-authorizations?limit=100');
    state.authorizations = r.authorizations || [];
    renderAuthorizations();
    toast(`${state.authorizations.length} authorization record${state.authorizations.length === 1 ? '' : 's'}`);
  } catch (err) {
    e.authorizationList.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    toast(err.message);
  } finally {
    busy(e.authorizationRefresh, false, 'Refresh');
  }
}

function renderAuthorizations() {
  if (!state.authorizations.length) {
    e.authorizationList.innerHTML = '<p class="muted">No authorization history.</p>';
    return;
  }
  e.authorizationList.innerHTML = '';
  state.authorizations.forEach(a => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'message-item';
    const target = a.request?.target?.arguments || {}, proof = target.metadata?.proof, label = proof ? `Proof ${proof}` : (target.title || a.tool_id || 'mutation');
    b.innerHTML = `<strong>${esc(label)}</strong><div class="meta">${esc(a.tool_id || 'mutation')} · ${esc(target.chain || target.repo || '')}${target.path ? ` · ${esc(target.path)}` : ''}</div><div class="meta">${esc(short(a.authorization_request_id))} · ${esc(a.status || '')}</div>`;
    b.addEventListener('click', () => selectAuthorization(a));
    e.authorizationList.append(b);
  });
}

function selectAuthorization(a) {
  state.selectedAuthorization = a;
  const req = a.request || {}, target = req.target || {}, args = target.arguments || {}, guard = req.guard || a.guard || null;
  e.authorizationTitle.textContent = `${a.tool_id || target.tool_id || 'Mutation'} · ${a.status || 'unknown'}`;
  e.authorizationMeta.innerHTML = [['request', short(a.authorization_request_id)], ['stone', short(a.request_stone_hash)], ['package', short(a.package_id)], ['decision', short(a.decision_id)], ['digest', short(a.argument_digest)]].map(([k, v]) => chip(`${k}: ${v || '—'}`)).join('');
  e.authorizationSummary.innerHTML = [
    ['Tool ID', a.tool_id || target.tool_id || '—'],
    ['Target chain/repo', args.chain || args.repo || '—'],
    ['Target path/resource', args.path || '—'],
    ['Material effect', authorizationEffect(a)],
    ['Argument digest', a.argument_digest || '—'],
    ['Guard', guard ? `${guard.type}: expected ${guard.expected_value ?? 'null'}` : 'NONE'],
    ['Authorization mode', a.required_authorization || req.required_authorization || '—'],
    ['One-time / expiry', 'One-time; expiry is minted with approval']
  ].map(evidenceCell).join('');
  e.authorizationArguments.textContent = JSON.stringify(args, null, 2);
  e.authorizationRaw.textContent = JSON.stringify(a, null, 2);
  const pending = a.status === 'pending';
  e.authorizationReject.disabled = !pending;
  e.authorizationApprove.disabled = !pending;
}

function authorizationEffect(a) {
  const args = a.request?.target?.arguments || {};
  if ((a.tool_id || a.request?.target?.tool_id) === 'cairnstone_commit_v2') return `Create/accept immutable stone${args.path ? ` at ${args.path}` : ''}${args.set_as_head === true ? ' and move chain HEAD' : ''}`;
  if ((a.tool_id || '').includes('set_path_head')) return 'Move one accepted path HEAD';
  if ((a.tool_id || '').includes('set_head')) return 'Move one canonical chain HEAD';
  return 'Mutation requiring explicit human confirmation';
}

async function decideAuthorization(decision) {
  const a = state.selectedAuthorization;
  if (!a) return toast('Select a pending authorization');
  const approve = decision === 'approve';
  busy(approve ? e.authorizationApprove : e.authorizationReject, true, approve ? 'Approving…' : 'Rejecting…');
  try {
    const r = await operatorCall(`/v1/tool-authorizations/${encodeURIComponent(a.authorization_request_id)}/decision`, { method: 'POST', body: { decision, execute: approve, ttl_seconds: 900 } });
    e.authorizationResult.textContent = JSON.stringify(r, null, 2);
    toast(approve ? (r.execution?.ok ? 'Authorized and executed' : 'Authorization decision recorded') : 'Authorization rejected');
    state.selectedAuthorization = null;
    await refreshAuthorizations();
  } catch (err) {
    e.authorizationResult.textContent = JSON.stringify(err.payload || { error: err.message }, null, 2);
    toast(err.message);
  } finally {
    busy(approve ? e.authorizationApprove : e.authorizationReject, false, approve ? 'Approve & Execute' : 'Reject');
  }
}

function list(el, items, fmt) {
  const xs = Array.isArray(items) ? items : [];
  el.innerHTML = xs.length ? xs.map(x => `<div class="list-item">${fmt(x)}</div>`).join('') : '<div class="list-item">No evidence returned.</div>';
}
function chip(s) { return `<span class="chip" title="${esc(s)}">${esc(s)}</span>`; }
function short(v) { if (!v) return '—'; v = String(v); return v.length > 28 ? `${v.slice(0, 18)}…${v.slice(-7)}` : v; }
function tok(v) { return Number.isFinite(Number(v)) ? `${Number(v)} tok` : '—'; }
function pretty(v) { try { return JSON.stringify(JSON.parse(v), null, 2); } catch { return String(v ?? ''); } }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
function busy(button, on, label) { button.disabled = on; button.textContent = label; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
let toastTimer;
function toast(message) {
  clearTimeout(toastTimer);
  e.toast.textContent = message;
  e.toast.classList.add('show');
  toastTimer = setTimeout(() => e.toast.classList.remove('show'), 2400);
}
function panel(name) {
  const panelName = name === 'work' ? 'code' : name;
  const primary = PRIMARY_BY_PANEL[panelName] || 'chat';
  document.querySelectorAll('.nav-item').forEach(t => t.classList.toggle('active', t.dataset.nav === primary));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${panelName}`));
  if (e.inboxSubnav) e.inboxSubnav.classList.toggle('hidden', primary !== 'inbox');
  if (e.moreSubnav) e.moreSubnav.classList.toggle('hidden', primary !== 'more');
  document.querySelectorAll('#inboxSubnav .subnav-item, #moreSubnav .subnav-item').forEach(t => {
    t.classList.toggle('active', t.dataset.panel === panelName);
  });
  if (primary === 'more') syncSettingsPreview();
  if (panelName === 'universe') syncUniverseLanding();
  if (primary === 'inbox') syncCommsHub(panelName);
}

function syncCommsHub(panelName) {
  const banner = commsHubBanner(panelName);
  const map = {
    inbox: { eyebrow: 'inboxHubEyebrow', blurb: 'inboxHubBlurb', scope: 'inboxHubScopeNote' },
    handoff: { eyebrow: 'handoffHubEyebrow', blurb: 'handoffHubBlurb', scope: 'handoffHubScopeNote' },
    activity: { eyebrow: 'activityHubEyebrow', blurb: 'activityHubBlurb', scope: 'activityHubScopeNote' }
  };
  const ids = map[panelName];
  if (!ids) return;
  const eyebrow = $(ids.eyebrow);
  const blurb = $(ids.blurb);
  const scope = $(ids.scope);
  if (eyebrow) eyebrow.textContent = banner.eyebrow;
  if (blurb) blurb.textContent = banner.blurb;
  if (scope) scope.textContent = banner.scopeNote;
}

function navigatePrimary(nav) {
  const primary = String(nav || 'chat');
  if (primary === 'universe') {
    panel('universe');
    return;
  }
  panel(DEFAULT_PANEL_BY_PRIMARY[primary] || 'chat');
}

function openSheet(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSheet(id) {
  const el = typeof id === 'string' ? $(id) : id;
  if (!el) return;
  el.classList.add('hidden');
  const openSheets = [e.scopeSheet, e.runtimeSheet, e.chatConfigSheet, e.evidenceDrawer]
    .some(s => s && !s.classList.contains('hidden'));
  if (!openSheets) document.body.style.overflow = '';
}

function syncContextBar({ scopePending = false } = {}) {
  if (e.contextScopeLabel) {
    if (scopePending) e.contextScopeLabel.textContent = 'Resolving…';
    else if (e.scopeSummary?.textContent) e.contextScopeLabel.textContent = e.scopeSummary.textContent;
    else e.contextScopeLabel.textContent = scopeLabel();
  }
  if (e.contextActorLabel && e.actorId) e.contextActorLabel.textContent = e.actorId.value.trim() || '—';
  if (e.contextSessionLabel) {
    const sid = currentCodeSessionId();
    e.contextSessionLabel.textContent = sid ? short(sid) : '—';
  }
  syncUniverseLanding();
  syncSettingsPreview();
}

function syncUniverseLanding() {
  if (e.universeLandingSummary && e.scopeSummary) e.universeLandingSummary.textContent = e.scopeSummary.textContent;
  if (e.universeLandingAuthority && e.scopeAuthority) e.universeLandingAuthority.textContent = e.scopeAuthority.textContent;
  if (e.universeLandingLod) {
    e.universeLandingLod.textContent = `LOD: ${zoomLabel(state.universeLod)} · view: ${normalizeViewMode(state.universeViewMode)}`;
  }
}

function syncSettingsPreview() {
  if (e.settingsActorPreview && e.actorId) e.settingsActorPreview.textContent = e.actorId.value.trim() || '—';
  if (e.settingsRuntimePreview && e.runtimeUrl) e.settingsRuntimePreview.textContent = e.runtimeUrl.value.trim() || '—';
}

async function copy(value) { await navigator.clipboard.writeText(value); toast('Copied'); }

document.querySelectorAll('.nav-item[data-nav]').forEach(t => t.addEventListener('click', () => navigatePrimary(t.dataset.nav)));
document.querySelectorAll('.subnav-item[data-panel]').forEach(t => t.addEventListener('click', () => panel(t.dataset.panel)));
e.providerSelect.addEventListener('change', renderModels);
e.healthButton.addEventListener('click', () => health().catch(() => {}));
if (e.contextRuntimeBtn) e.contextRuntimeBtn.addEventListener('click', () => openSheet('runtimeSheet'));
if (e.contextScopeBtn) e.contextScopeBtn.addEventListener('click', () => openSheet('scopeSheet'));
if (e.contextActorBtn) e.contextActorBtn.addEventListener('click', () => openSheet('runtimeSheet'));
if (e.contextSessionBtn) e.contextSessionBtn.addEventListener('click', () => panel('code'));
if (e.settingsOpenSheet) e.settingsOpenSheet.addEventListener('click', () => openSheet('runtimeSheet'));
if (e.runtimeSheetRecheck) e.runtimeSheetRecheck.addEventListener('click', () => health().catch(() => {}));
if (e.universeOpenScope) e.universeOpenScope.addEventListener('click', () => openSheet('scopeSheet'));
if (e.universeOpenRuntime) e.universeOpenRuntime.addEventListener('click', () => openSheet('runtimeSheet'));
if (e.openChatConfig) e.openChatConfig.addEventListener('click', () => openSheet('chatConfigSheet'));
if (e.openEvidenceDrawer) e.openEvidenceDrawer.addEventListener('click', openEvidenceDrawerForResult);
document.querySelectorAll('[data-close-sheet]').forEach(btn => {
  btn.addEventListener('click', () => closeSheet(btn.getAttribute('data-close-sheet')));
});
e.refreshModels.addEventListener('click', loadCapabilities);
e.delegateButton.addEventListener('click', askCurrentScope);
e.refreshInbox.addEventListener('click', refreshInbox);
if (e.inboxGroupThreads) e.inboxGroupThreads.addEventListener('change', renderInbox);
e.handoffButton.addEventListener('click', handoff);
e.copyResult.addEventListener('click', () => copy(groundedAnswerText(state.lastResult) || state.lastResult?.answer || state.lastResult?.output?.text || ''));
e.copyEvidence.addEventListener('click', () => copy(JSON.stringify({ scope_snapshot: state.scopeSnapshot, result: state.lastResult }, null, 2)));
if (e.toolDelegate) e.toolDelegate.addEventListener('change', () => { saveSettings(); renderChatMode(); });
e.activityRefresh.addEventListener('click', refreshActivity);
e.activityFilter.addEventListener('change', renderActivity);
e.activityGroupThreads.addEventListener('change', renderActivity);
e.stonesRefresh.addEventListener('click', refreshStones);
e.copyStoneHash.addEventListener('click', () => copy(state.selectedStone?.hash || state.selectedStone?.stone_hash || ''));
e.authorizationRefresh.addEventListener('click', refreshAuthorizations);
e.authorizationReject.addEventListener('click', () => decideAuthorization('deny'));
e.authorizationApprove.addEventListener('click', () => decideAuthorization('approve'));
e.operatorToken.addEventListener('input', () => {
  const v = e.operatorToken.value.trim();
  if (v) sessionStorage.setItem('cs.operatorToken', v); else sessionStorage.removeItem('cs.operatorToken');
});

e.scopeSearch.addEventListener('input', renderScopeCatalog);
e.scopeAll.addEventListener('click', () => setScope({ mode: 'vault', max_chains: 200 }, 'All CairnStone'));
e.scopeDefault.addEventListener('click', () => setScope({ mode: 'single_chain', chains: [DEFAULT_CHAIN], max_chains: 200 }, DEFAULT_CHAIN));
e.universeButton.addEventListener('click', openUniverse);
e.universeClose.addEventListener('click', closeUniverse);
e.universeOverlay.addEventListener('click', event => { if (event.target === e.universeOverlay) closeUniverse(); });
e.universeSearch.addEventListener('input', () => { focusUniverseSearch(); });
e.universeLod.addEventListener('click', () => setUniverseZoom(zoomIn(state.universeLod)).catch(err => toast(err.message)));
if (e.universeZoomIn) e.universeZoomIn.addEventListener('click', () => setUniverseZoom(zoomIn(state.universeLod)).catch(err => toast(err.message)));
if (e.universeZoomOut) e.universeZoomOut.addEventListener('click', () => setUniverseZoom(zoomOut(state.universeLod)).catch(err => toast(err.message)));
[e.universeViewSpatial, e.universeViewList, e.universeViewGrid].forEach(btn => {
  if (!btn) return;
  btn.addEventListener('click', () => setUniverseViewMode(btn.dataset.view));
});
e.universeMulti.addEventListener('click', () => {
  state.universeMultiMode = !state.universeMultiMode;
  if (state.universeMultiMode && !state.universeMultiSelection.size && (state.scopeSnapshot?.chains?.length || 0) <= 12) {
    state.universeMultiSelection = new Set(state.scopeSnapshot.chains.map(x => x.chain));
  }
  renderUniverse().catch(err => toast(err.message));
});
e.universeApply.addEventListener('click', applyUniverseMulti);
bindUniversePanZoom();
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!e.universeOverlay.classList.contains('hidden')) return closeUniverse();
  if (e.evidenceDrawer && !e.evidenceDrawer.classList.contains('hidden')) return closeSheet('evidenceDrawer');
  if (e.chatConfigSheet && !e.chatConfigSheet.classList.contains('hidden')) return closeSheet('chatConfigSheet');
  if (e.scopeSheet && !e.scopeSheet.classList.contains('hidden')) return closeSheet('scopeSheet');
  if (e.runtimeSheet && !e.runtimeSheet.classList.contains('hidden')) return closeSheet('runtimeSheet');
});

[e.runtimeUrl, e.actorId, e.inboxActor, e.activityActors].forEach(x => x.addEventListener('change', () => {
  saveSettings();
  syncContextBar();
}));
const codeSessionInput = $('codeSessionId');
if (codeSessionInput) {
  codeSessionInput.addEventListener('change', syncContextBar);
  codeSessionInput.addEventListener('input', syncContextBar);
}

loadSettings();
renderChatMode();
syncContextBar();
panel('chat');

const inviteApi = initInvitePanel({
  mcpCall,
  operatorCall,
  toast,
  busy,
  esc,
  chip,
  actorId: () => (e.actorId?.value || 'console:jared').trim()
});

initCodeSessionPanel({
  mcpCall,
  toast,
  busy,
  esc,
  chip,
  actorId: () => (e.actorId?.value || 'console:jared').trim(),
  panel,
  invitePrefill: (opts) => inviteApi?.prefillForCodeSession?.(opts)
});
await health().catch(() => {});
await loadVaultCatalog().catch(err => {
  e.scopeCatalog.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
});
await loadCapabilities();
syncContextBar();