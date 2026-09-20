import { initInvitePanel, mintWorkspaceInviteAndNotify } from './invite.js';
import { initCodeSessionPanel } from './code-session.js';
import { initWorkGuidePanel } from './work-guide-panel.js';
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
  ACTIVITY_NAV_STORE_KEY,
  HANDOFF_NAV_STORE_KEY,
  INBOX_NAV_STORE_KEY,
  actorCardModel,
  actorPickerPrompt,
  buildActorDirectory,
  collectObservedIdsFromMessages,
  defaultHandoffRecipients,
  filterMessagesByPlane,
  loadJsonStore,
  loadObservedIds,
  mailboxPlaneBadge,
  mergeObservedIds,
  normalizeInboxSelection,
  normalizeMultiSelection,
  parseLegacyActorField,
  parseMailboxId,
  planesAvailable,
  recipientIdsForSelection,
  saveJsonStore,
  saveObservedIds,
  summarizeActorFromMessages
} from './actor-inbox-nav.js';
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
  preserveSelection,
  scopeSelectorFromEntity,
  searchToFocus,
  universeSurfaceState,
  zoomIn,
  zoomLabel,
  zoomOut
} from './universe-v2.js';
import {
  captureCurrentView,
  deleteSavedView,
  listSavedViewSummaries,
  loadSavedViewsStore,
  openSavedView,
  upsertSavedView
} from './saved-views.js';
import {
  applyWorkDisclosurePrefs,
  authorizeDisclosureModel,
  evidenceDisclosureModel,
  scopeDisclosureModel,
  stonesDisclosureModel,
  workDisclosurePrefsFromDom
} from './progressive-disclosure.js';
import { applyReducedMotionClass } from './ux-acceptance.js';
import {
  MESSAGE_READER_SHEET_ID,
  captureListScroll,
  focusReaderTitle,
  readerErrorCopy,
  readerLoadingCopy,
  restoreListScroll,
  scrollReaderIntoView,
  shouldNavigateToInboxForRead,
  shouldPopReaderHistory,
  shouldPushReaderHistory,
  shouldUseFocusedReader,
  stickyChromeOffset
} from './message-reader-focus.js';
import {
  ACCESS_GRANT_TOOLS,
  buildAccessGrantProposal,
  buildAssignProposal,
  buildAttachmentResolveArgs,
  buildForwardWithNotePayload,
  buildRevokeProposal,
  grantStatusLabel,
  isToolMissingError,
  localResolveAttachment,
  mcpArgsFromProposal,
  objectRefFromCodeSession,
  objectRefFromMessage,
  objectRefFromResponse,
  objectRefFromStone,
  permissionLabel,
  sanitizeMcpArgs,
  shareModeLabel,
  summarizeProposalCard,
  toolMissingHonesty
} from './access-share.js';
import {
  INTENT_TOOLS,
  buildIntentRouteArgs,
  buildDispatchCommitArgs,
  commitProposalTool,
  compileDispatchCommitCard,
  compileIntentProposalCard,
  summarizeProposalCard as summarizeIntentCard
} from './intent-proposal.js';
import {
  AGENT_TREE_TOOL,
  EVENT_LIST_TOOL,
  buildAgentTreeArgs,
  buildEventListArgs,
  compileAgentTreeCard,
  compileEventListCard,
  subscribeHonesty,
  summarizeEventCard
} from './event-plane.js';
import {
  PREVIEW_TOOL,
  SAMPLE_RETENTION_CANDIDATES,
  buildPreviewArgs,
  compileRetentionCard,
  summarizeRetentionCard
} from './context-retention.js';

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
  universeMultiSelection: new Set(),
  activePanel: 'chat',
  savedViewFreshness: null,
  actorNav: {
    observed: [],
    directory: [],
    stats: {},
    inbox: { actorKey: '', plane: 'all' },
    activityKeys: [],
    handoffKeys: [],
    customActivityIds: [],
    customHandoffIds: []
  },
  messageReader: {
    source: null,
    scrollSnap: null,
    returnPanel: null,
    historyPushed: false,
    closingFromPopstate: false
  },
  share: {
    mode: 'give-access',
    source: null,
    object: null,
    principalKey: '',
    customPrincipal: '',
    lastMessage: null,
    grants: [],
    proposal: null,
    toolAvailability: null
  },
  intent: {
    routeResult: null,
    proposalCard: null,
    dispatchCard: null
  }
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
  access: 'more',
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
  contextScopeBtn: $('contextScopeBtn'), contextActorBtn: $('contextActorBtn'), contextChatBtn: $('contextChatBtn'), contextCodeBtn: $('contextCodeBtn'), contextRuntimeBtn: $('contextRuntimeBtn'),
  contextScopeLabel: $('contextScopeLabel'), contextActorLabel: $('contextActorLabel'), contextChatLabel: $('contextChatLabel'), contextCodeLabel: $('contextCodeLabel'),
  inboxSubnav: $('inboxSubnav'), moreSubnav: $('moreSubnav'),
  inboxGroupThreads: $('inboxGroupThreads'),
  scopeSheet: $('scopeSheet'), runtimeSheet: $('runtimeSheet'), chatConfigSheet: $('chatConfigSheet'), evidenceDrawer: $('evidenceDrawer'),
  shareSheet: $('shareSheet'), shareSheetTitle: $('shareSheetTitle'), shareSheetBlurb: $('shareSheetBlurb'),
  shareObjectRef: $('shareObjectRef'), shareObjectMeta: $('shareObjectMeta'), shareResolveNote: $('shareResolveNote'),
  shareActorPicker: $('shareActorPicker'), shareActorMeta: $('shareActorMeta'), shareActorNavLabel: $('shareActorNavLabel'),
  sharePrincipal: $('sharePrincipal'), sharePermission: $('sharePermission'), shareNotify: $('shareNotify'),
  shareGiveFields: $('shareGiveFields'), shareAssignFields: $('shareAssignFields'), shareForwardFields: $('shareForwardFields'),
  shareAssignTask: $('shareAssignTask'), shareForwardNote: $('shareForwardNote'), shareForwardSubject: $('shareForwardSubject'),
  shareProposalTitle: $('shareProposalTitle'), shareProposalLines: $('shareProposalLines'),
  shareHumanCommit: $('shareHumanCommit'), shareCommitButton: $('shareCommitButton'), shareResult: $('shareResult'),
  messageShareActions: $('messageShareActions'), messageReaderSheetShareActions: $('messageReaderSheetShareActions'),
  evidenceShareActions: $('evidenceShareActions'), evidenceDrawerShareActions: $('evidenceDrawerShareActions'),
  stoneGiveAccess: $('stoneGiveAccess'), stoneAssign: $('stoneAssign'), stoneForward: $('stoneForward'),
  accessGrantsRefresh: $('accessGrantsRefresh'), accessGrantsObjectRef: $('accessGrantsObjectRef'),
  accessGrantsHonesty: $('accessGrantsHonesty'), accessGrantsList: $('accessGrantsList'),
  messageReaderSheet: $('messageReaderSheet'), messageReaderSheetTitle: $('messageReaderSheetTitle'),
  messageReaderSheetMeta: $('messageReaderSheetMeta'), messageReaderSheetContent: $('messageReaderSheetContent'),
  messageReaderBack: $('messageReaderBack'), messageReaderCard: $('messageReaderCard'),
  savedViewsSheet: $('savedViewsSheet'),
  contextViewsBtn: $('contextViewsBtn'), contextViewsLabel: $('contextViewsLabel'),
  savedViewName: $('savedViewName'), savedViewSave: $('savedViewSave'), savedViewsList: $('savedViewsList'),
  savedViewFreshness: $('savedViewFreshness'), scopeAdvanced: $('scopeAdvanced'),
  settingsOpenSheet: $('settingsOpenSheet'), settingsActorPreview: $('settingsActorPreview'), settingsRuntimePreview: $('settingsRuntimePreview'),
  runtimeSheetRecheck: $('runtimeSheetRecheck'),
  codeSessionId: $('codeSessionId'),
  openChatConfig: $('openChatConfig'), openEvidenceDrawer: $('openEvidenceDrawer'),
  chatConfigHonesty: $('chatConfigHonesty'), chatConfigRouteNote: $('chatConfigRouteNote'),
  chatCapabilityHonesty: $('chatCapabilityHonesty'), evidenceDrawerHint: $('evidenceDrawerHint'),
  evidenceDrawerTitle: $('evidenceDrawerTitle'), evidenceDrawerSubtitle: $('evidenceDrawerSubtitle'), evidenceDrawerBody: $('evidenceDrawerBody'),
  evidenceHonesty: $('evidenceHonesty'), evidenceEmptyState: $('evidenceEmptyState'),
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
  inboxActorPicker: $('inboxActorPicker'), inboxPlaneTabs: $('inboxPlaneTabs'), inboxActorMeta: $('inboxActorMeta'), inboxActorNavLabel: $('inboxActorNavLabel'),
  handoffChain: $('handoffChain'), handoffTo: $('handoffTo'), handoffSubject: $('handoffSubject'), handoffTask: $('handoffTask'), handoffPackage: $('handoffPackage'), handoffPriority: $('handoffPriority'),
  handoffActorPicker: $('handoffActorPicker'), handoffActorMeta: $('handoffActorMeta'), handoffActorNavLabel: $('handoffActorNavLabel'),
  continuationHash: $('continuationHash'), continuationPath: $('continuationPath'), artifactOwner: $('artifactOwner'), artifactRepo: $('artifactRepo'), artifactPath: $('artifactPath'), artifactCommit: $('artifactCommit'),
  mirrorOwner: $('mirrorOwner'), mirrorRepo: $('mirrorRepo'), mirrorBranch: $('mirrorBranch'), mirrorPrefix: $('mirrorPrefix'), handoffButton: $('handoffButton'), handoffResult: $('handoffResult'),
  activityRefresh: $('activityRefresh'), activityActors: $('activityActors'), activityFilter: $('activityFilter'), activityGroupThreads: $('activityGroupThreads'), activityList: $('activityList'),
  activityActorPicker: $('activityActorPicker'), activityActorMeta: $('activityActorMeta'), activityActorNavLabel: $('activityActorNavLabel'),
  stonesRefresh: $('stonesRefresh'), stonesQuery: $('stonesQuery'), stonesHead: $('stonesHead'), stonesList: $('stonesList'), stoneDetailTitle: $('stoneDetailTitle'), stoneDetailMeta: $('stoneDetailMeta'),
  stoneDetailSummary: $('stoneDetailSummary'), stoneDetailRaw: $('stoneDetailRaw'), copyStoneHash: $('copyStoneHash'),
  stonesEmptyState: $('stonesEmptyState'), stonesDetailBlock: $('stonesDetailBlock'), stonesRawBlock: $('stonesRawBlock'),
  operatorToken: $('operatorToken'), authorizationRefresh: $('authorizationRefresh'), authorizationList: $('authorizationList'), authorizationTitle: $('authorizationTitle'),
  authorizationMeta: $('authorizationMeta'), authorizationSummary: $('authorizationSummary'), authorizationArguments: $('authorizationArguments'), authorizationRaw: $('authorizationRaw'),
  authorizationReject: $('authorizationReject'), authorizationApprove: $('authorizationApprove'), authorizationResult: $('authorizationResult'),
  authorizationEmptyState: $('authorizationEmptyState'), authorizeArgsBlock: $('authorizeArgsBlock'), authorizeRawBlock: $('authorizeRawBlock'),
  intentText: $('intentText'), intentRouteButton: $('intentRouteButton'),
  intentProposalTitle: $('intentProposalTitle'), intentProposalLines: $('intentProposalLines'),
  intentHumanCommit: $('intentHumanCommit'), intentCommitProposal: $('intentCommitProposal'),
  dispatchTaskRunId: $('dispatchTaskRunId'), dispatchHumanCommit: $('dispatchHumanCommit'),
  dispatchCommitButton: $('dispatchCommitButton'), intentResult: $('intentResult'),
  eventTaskRunId: $('eventTaskRunId'), eventPollButton: $('eventPollButton'),
  eventTreeButton: $('eventTreeButton'), eventResult: $('eventResult'),
  retentionPreviewButton: $('retentionPreviewButton'), retentionResult: $('retentionResult'),
  toast: $('toast')
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
  loadActorNavSettings();
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
  saveActorNavSettings();
}

async function mcpCall(name, args = {}) {
  saveSettings();
  const MCP_CALL_TIMEOUT_MS = 10000; // 8–12s band — fail closed, never hang Work resolve
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MCP_CALL_TIMEOUT_MS);
  let r;
  try {
    r = await fetch(e.runtimeUrl.value.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: 'tools/call', params: { name, arguments: args } }),
      signal: controller.signal
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      const te = new Error(`MCP call timed out after ${MCP_CALL_TIMEOUT_MS / 1000}s`);
      te.code = 'MCP_TIMEOUT';
      te.blocked = true;
      te.cta = 'Retry resolve';
      te.timeoutMs = MCP_CALL_TIMEOUT_MS;
      throw te;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
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
    state.share.toolAvailability = Array.isArray(r.mcp_tools) ? r.mcp_tools : null;
    setHealth('ok', `${r.version || 'live'} · ${r.mcp_tools?.length || 0} tools`);
    return r;
  } catch (err) {
    setHealth('bad', 'Offline');
    toast(err.message);
    throw err;
  }
}

function workerHasTool(name) {
  const tools = state.share.toolAvailability;
  if (!Array.isArray(tools)) return null;
  return tools.includes(name);
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
  const snap = await resolveCurrentScope({ recordRecent, recentLabel: label });
  if (!e.universeOverlay.classList.contains('hidden')) renderUniverse().catch(() => {});
  return snap;
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
  syncScopeDisclosure({ loading: true });
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
    syncScopeDisclosure({ resolved: true, diagnostics: diagnostics.join(' ') });
    return snap;
  } catch (err) {
    state.scopeSnapshot = null;
    e.scopeSummary.textContent = 'Scope unavailable';
    e.scopeAuthority.textContent = err.message;
    e.scopeCoverage.textContent = '';
    updateScopeDependents();
    syncContextBar();
    syncScopeDisclosure({ error: err });
    toast(err.message);
    throw err;
  }
}

function syncScopeDisclosure({ loading = false, error = null, resolved = Boolean(state.scopeSnapshot), diagnostics = '' } = {}) {
  const model = scopeDisclosureModel({
    resolved,
    loading,
    error,
    summary: e.scopeSummary?.textContent || '',
    authorityLine: e.scopeAuthority?.textContent || '',
    diagnostics: diagnostics || e.scopeCoverage?.textContent || '',
    pickerOpen: Boolean(e.scopePicker?.open),
    advancedOpen: Boolean(e.scopeAdvanced?.open)
  });
  if (e.scopeAdvanced && diagnostics) {
    // Keep coverage text in the advanced block; open only when there is content and user left it open.
    if (diagnostics && !e.scopeAdvanced.dataset.userTouched) {
      e.scopeAdvanced.open = Boolean(diagnostics);
    }
  }
  return model;
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

  [e.providerSelect, e.modelSelect].forEach(control => {
    if (control) control.disabled = !cfg.routeControlsEditable;
  });
  [e.credentialAlias, e.temperature, e.includeInbox].forEach(control => {
    if (control) control.disabled = !cfg.routeControlsEnabled;
  });
  if (e.outputTokens) e.outputTokens.disabled = false;
  if (e.refreshModels) e.refreshModels.disabled = false;

  const chain = state.scopeSnapshot?.chains?.[0]?.chain || state.scope.chains?.[0] || DEFAULT_CHAIN;
  const n = state.scopeSnapshot?.chains?.length || 0;
  if (e.chatModeNote) {
    if (!scopeResolved) {
      e.chatModeNote.textContent = 'Resolving Scope… provider/model stay selectable in Chat config; Ask waits for resolved Scope.';
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
  if (e.evidenceDrawerShareActions) e.evidenceDrawerShareActions.hidden = !objectRefFromResponse(state.lastResult);
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
  if (!r || typeof r !== 'object' || Array.isArray(r)) {
    clearAnswerDepthUi();
    e.resultTitle.textContent = 'No result yet';
    e.resultText.textContent = '(No answer returned)';
    e.resultMeta.innerHTML = '';
    syncEvidenceDrawerCta(null);
    e.copyResult.disabled = false;
    return;
  }
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
  const hasResult = Boolean(r) || Boolean(snap);
  if (e.evidenceEmptyState) e.evidenceEmptyState.classList.toggle('hidden', hasResult);
  const sectionsOpen = [...document.querySelectorAll('#evidenceDisclosure details[data-evidence-section]')]
    .filter(el => el.open)
    .map(el => el.dataset.evidenceSection);
  const model = evidenceDisclosureModel({ hasResult, sectionsOpen: sectionsOpen.length ? sectionsOpen : ['accepted'] });
  if (e.evidenceHonesty && model.namingNote) {
    e.evidenceHonesty.innerHTML = `Authority summary first. Deeper refs expand on demand. <code>response_lod</code> ≠ <code>stone_lod</code>.`;
  }
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
  } else if (r || snap) {
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
  } else {
    e.authoritySummary.innerHTML = '';
    if (e.pathHeads) e.pathHeads.innerHTML = '';
    if (e.skillsList) e.skillsList.innerHTML = '';
    if (e.memoryRefs) e.memoryRefs.innerHTML = '';
    if (e.observability) e.observability.textContent = '{}';
  }
  e.copyEvidence.disabled = !r && !state.scopeSnapshot;
  if (e.evidenceShareActions) e.evidenceShareActions.hidden = !objectRefFromResponse(r || state.lastResult);
}

function evidenceCell([label, value]) {
  return `<div class="evidence-item"><span class="muted small">${esc(label)}</span><strong>${esc(String(value))}</strong></div>`;
}

/* —— Actor Inbox Navigator (presentation / discovery only) —— */

function rebuildActorDirectory() {
  state.actorNav.directory = buildActorDirectory({ observedIds: state.actorNav.observed });
  return state.actorNav.directory;
}

function rememberObservedIds(ids = []) {
  state.actorNav.observed = mergeObservedIds(state.actorNav.observed, ids);
  saveObservedIds(state.actorNav.observed);
  rebuildActorDirectory();
}

function loadActorNavSettings() {
  const legacyInbox = parseLegacyActorField(e.inboxActor?.value || '');
  const legacyActivity = parseLegacyActorField(e.activityActors?.value || '');
  const legacyHandoff = parseLegacyActorField(e.handoffTo?.value || '');
  const runtimeActor = parseLegacyActorField(e.actorId?.value || '');

  state.actorNav.observed = mergeObservedIds(
    loadObservedIds(),
    [...legacyInbox.ids, ...legacyActivity.ids, ...legacyHandoff.ids, ...runtimeActor.ids]
  );
  rebuildActorDirectory();

  const storedInbox = loadJsonStore(INBOX_NAV_STORE_KEY) || {};
  if (!storedInbox.actorKey && legacyInbox.keys[0]) storedInbox.actorKey = legacyInbox.keys[0];
  state.actorNav.inbox = normalizeInboxSelection(storedInbox, state.actorNav.directory);

  const storedActivity = loadJsonStore(ACTIVITY_NAV_STORE_KEY);
  const activityFallback = Array.isArray(storedActivity?.keys)
    ? storedActivity.keys
    : legacyActivity.keys;
  state.actorNav.activityKeys = normalizeMultiSelection(activityFallback, state.actorNav.directory, {
    fallbackKeys: legacyActivity.keys.length ? legacyActivity.keys : ['claude', 'grok']
  });
  state.actorNav.customActivityIds = Array.isArray(storedActivity?.customIds)
    ? storedActivity.customIds
    : [];

  const storedHandoff = loadJsonStore(HANDOFF_NAV_STORE_KEY);
  const handoffFallback = Array.isArray(storedHandoff?.keys)
    ? storedHandoff.keys
    : legacyHandoff.keys;
  state.actorNav.handoffKeys = normalizeMultiSelection(handoffFallback, state.actorNav.directory, {
    fallbackKeys: legacyHandoff.keys.length ? legacyHandoff.keys : ['claude']
  });
  state.actorNav.customHandoffIds = Array.isArray(storedHandoff?.customIds)
    ? storedHandoff.customIds
    : [];

  syncInboxActorFieldFromSelection();
  syncActivityActorsFieldFromSelection();
  syncHandoffToFieldFromSelection();
  renderAllActorNavigators();
}

function saveActorNavSettings() {
  saveObservedIds(state.actorNav.observed);
  saveJsonStore(INBOX_NAV_STORE_KEY, state.actorNav.inbox);
  saveJsonStore(ACTIVITY_NAV_STORE_KEY, {
    keys: state.actorNav.activityKeys,
    customIds: state.actorNav.customActivityIds
  });
  saveJsonStore(HANDOFF_NAV_STORE_KEY, {
    keys: state.actorNav.handoffKeys,
    customIds: state.actorNav.customHandoffIds
  });
}

function actorByKey(key) {
  return state.actorNav.directory.find(a => a.key === key) || null;
}

function syncInboxActorFieldFromSelection() {
  if (!e.inboxActor) return;
  const actor = actorByKey(state.actorNav.inbox.actorKey);
  const ids = recipientIdsForSelection(actor, state.actorNav.inbox.plane);
  if (ids.length === 1) e.inboxActor.value = ids[0];
  else if (ids.length > 1 && !ids.includes(e.inboxActor.value.trim())) {
    e.inboxActor.value = ids[0];
  }
}

function syncActivityActorsFieldFromSelection() {
  if (!e.activityActors) return;
  const fromActors = state.actorNav.activityKeys.flatMap(key => {
    const actor = actorByKey(key);
    return actor ? actor.allMailboxIds : [];
  });
  const covered = new Set(fromActors);
  const extras = (state.actorNav.customActivityIds || []).filter(id => !covered.has(id));
  const ids = [...fromActors, ...extras].map(s => String(s).trim()).filter(Boolean);
  if (ids.length) e.activityActors.value = ids.join(', ');
}

function syncHandoffToFieldFromSelection() {
  if (!e.handoffTo) return;
  const fromActors = state.actorNav.handoffKeys.flatMap(key => defaultHandoffRecipients(actorByKey(key)));
  const covered = new Set(fromActors);
  const extras = (state.actorNav.customHandoffIds || []).filter(id => !covered.has(id));
  const ids = [...fromActors, ...extras].map(s => String(s).trim()).filter(Boolean);
  e.handoffTo.value = ids.join(', ');
}

function ingestCustomActorField(value, { into = 'observed' } = {}) {
  const { ids } = parseLegacyActorField(value);
  if (!ids.length) return ids;
  rememberObservedIds(ids);
  if (into === 'activity') {
    state.actorNav.customActivityIds = mergeObservedIds([], ids);
    const keys = ids.map(id => parseMailboxId(id)?.namespace?.toLowerCase()).filter(Boolean);
    state.actorNav.activityKeys = normalizeMultiSelection(
      [...state.actorNav.activityKeys, ...keys],
      state.actorNav.directory,
      { fallbackKeys: state.actorNav.activityKeys }
    );
  }
  if (into === 'handoff') {
    state.actorNav.customHandoffIds = mergeObservedIds([], ids);
    const keys = ids.map(id => parseMailboxId(id)?.namespace?.toLowerCase()).filter(Boolean);
    state.actorNav.handoffKeys = normalizeMultiSelection(
      [...state.actorNav.handoffKeys, ...keys],
      state.actorNav.directory,
      { fallbackKeys: state.actorNav.handoffKeys }
    );
  }
  if (into === 'inbox' && ids[0]) {
    const parsed = parseMailboxId(ids[0]);
    if (parsed?.namespace) {
      state.actorNav.inbox = normalizeInboxSelection(
        { actorKey: parsed.namespace.toLowerCase(), plane: parsed.plane === 'other' ? 'all' : (parsed.plane || 'all') },
        state.actorNav.directory
      );
    }
  }
  return ids;
}

function renderActorPicker(container, {
  mode = 'single',
  selectedKeys = [],
  onSelect
} = {}) {
  if (!container) return;
  const selected = new Set(selectedKeys);
  container.innerHTML = '';
  for (const actor of state.actorNav.directory) {
    const stats = state.actorNav.stats[actor.key] || null;
    const card = actorCardModel(actor, {
      selected: selected.has(actor.key),
      stats,
      mode
    });
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'actor-chip';
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', card.selected ? 'true' : 'false');
    btn.dataset.actorKey = actor.key;
    const unreadEmpty = card.unread ? '0' : '1';
    const badges = card.badges.map(b => `<span class="plane-badge" data-plane="${esc(b.plane)}">${esc(b.label)}</span>`).join('');
    const recent = card.recent
      ? `<div class="actor-chip-recent">${esc(card.recent)}</div>`
      : `<div class="actor-chip-recent">${esc(card.exactIds.join(' · ') || 'No mailbox yet')}</div>`;
    btn.innerHTML = `<div class="actor-chip-top"><span class="actor-chip-name">${esc(card.display)}</span><span class="actor-chip-unread" data-empty="${unreadEmpty}">${card.unread ? esc(String(card.unread)) : '0'}</span></div><div class="actor-chip-badges">${badges}</div>${recent}`;
    btn.addEventListener('click', () => onSelect?.(actor.key));
    container.append(btn);
  }
}

function renderInboxPlaneTabs() {
  if (!e.inboxPlaneTabs) return;
  const actor = actorByKey(state.actorNav.inbox.actorKey);
  const planes = planesAvailable(actor);
  const showPlanes = !!actor?.hasBothPlanes;
  e.inboxPlaneTabs.classList.toggle('hidden', !showPlanes);
  e.inboxPlaneTabs.innerHTML = '';
  if (!showPlanes) {
    if (state.actorNav.inbox.plane !== 'all') {
      state.actorNav.inbox.plane = 'all';
    }
    return;
  }
  const labels = { all: 'All', chat: 'Chat', work: 'Work' };
  for (const plane of planes) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mailbox-plane-tab';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', state.actorNav.inbox.plane === plane ? 'true' : 'false');
    btn.dataset.plane = plane;
    const unread = plane === 'all'
      ? state.actorNav.stats[actor?.key]?.unread
      : state.actorNav.stats[actor?.key]?.planeUnread?.[plane];
    const suffix = unread ? ` · ${unread}` : '';
    btn.textContent = `${labels[plane] || plane}${suffix}`;
    btn.addEventListener('click', () => {
      state.actorNav.inbox.plane = plane;
      syncInboxActorFieldFromSelection();
      saveActorNavSettings();
      renderAllActorNavigators();
      renderInbox();
    });
    e.inboxPlaneTabs.append(btn);
  }
}

function actorNavMetaText(actorKeys, { plane = null } = {}) {
  const actors = actorKeys.map(actorByKey).filter(Boolean);
  if (!actors.length) return 'No actors selected.';
  const bits = actors.map(a => {
    const ids = plane ? recipientIdsForSelection(a, plane) : a.allMailboxIds;
    return `${a.display} (${ids.join(', ')})`;
  });
  return bits.join(' · ');
}

function renderAllActorNavigators() {
  if (e.inboxActorNavLabel) e.inboxActorNavLabel.textContent = actorPickerPrompt('inbox');
  if (e.activityActorNavLabel) e.activityActorNavLabel.textContent = actorPickerPrompt('activity');
  if (e.handoffActorNavLabel) e.handoffActorNavLabel.textContent = actorPickerPrompt('handoff');

  renderActorPicker(e.inboxActorPicker, {
    mode: 'single',
    selectedKeys: state.actorNav.inbox.actorKey ? [state.actorNav.inbox.actorKey] : [],
    onSelect: (key) => {
      state.actorNav.inbox = normalizeInboxSelection(
        { actorKey: key, plane: state.actorNav.inbox.plane },
        state.actorNav.directory
      );
      syncInboxActorFieldFromSelection();
      saveActorNavSettings();
      renderAllActorNavigators();
    }
  });
  renderInboxPlaneTabs();
  if (e.inboxActorMeta) {
    e.inboxActorMeta.textContent = actorNavMetaText(
      state.actorNav.inbox.actorKey ? [state.actorNav.inbox.actorKey] : [],
      { plane: state.actorNav.inbox.plane }
    );
  }

  renderActorPicker(e.activityActorPicker, {
    mode: 'multi',
    selectedKeys: state.actorNav.activityKeys,
    onSelect: (key) => {
      const set = new Set(state.actorNav.activityKeys);
      if (set.has(key)) {
        if (set.size > 1) set.delete(key);
      } else set.add(key);
      state.actorNav.activityKeys = [...set];
      state.actorNav.customActivityIds = [];
      syncActivityActorsFieldFromSelection();
      saveActorNavSettings();
      renderAllActorNavigators();
    }
  });
  if (e.activityActorMeta) {
    e.activityActorMeta.textContent = actorNavMetaText(state.actorNav.activityKeys);
  }

  renderActorPicker(e.handoffActorPicker, {
    mode: 'multi',
    selectedKeys: state.actorNav.handoffKeys,
    onSelect: (key) => {
      const set = new Set(state.actorNav.handoffKeys);
      if (set.has(key)) {
        if (set.size > 1) set.delete(key);
      } else set.add(key);
      state.actorNav.handoffKeys = [...set];
      state.actorNav.customHandoffIds = [];
      syncHandoffToFieldFromSelection();
      saveActorNavSettings();
      renderAllActorNavigators();
    }
  });
  if (e.handoffActorMeta) {
    const recipients = (e.handoffTo?.value || '').split(',').map(s => s.trim()).filter(Boolean);
    e.handoffActorMeta.textContent = recipients.length
      ? `Will send to ${recipients.join(', ')}`
      : 'Select at least one recipient.';
  }

  renderShareActorPicker();
}

function inboxQueryRecipients() {
  const actor = actorByKey(state.actorNav.inbox.actorKey);
  const fromPicker = recipientIdsForSelection(actor, state.actorNav.inbox.plane);
  if (fromPicker.length) return fromPicker;
  const custom = e.inboxActor?.value?.trim();
  return custom ? [custom] : [];
}

function activityQueryRecipients() {
  syncActivityActorsFieldFromSelection();
  const fromField = (e.activityActors?.value || '').split(',').map(s => s.trim()).filter(Boolean);
  if (fromField.length) return [...new Set(fromField)];
  const runtime = e.actorId?.value?.trim();
  return runtime ? [runtime] : [];
}

function updateStatsFromMessages(messages, recipientHint = null) {
  const byActor = new Map();
  for (const m of messages || []) {
    const box = m.for || m.recipient_id || recipientHint || '';
    const parsed = parseMailboxId(box);
    const key = parsed?.namespace?.toLowerCase();
    if (!key) continue;
    if (!byActor.has(key)) byActor.set(key, []);
    byActor.get(key).push({ ...m, for: box });
  }
  for (const [key, msgs] of byActor.entries()) {
    state.actorNav.stats[key] = summarizeActorFromMessages(msgs);
  }
}

async function refreshInbox({ quiet = false } = {}) {
  const recipients = inboxQueryRecipients();
  if (!recipients.length) {
    if (!quiet) toast('Choose an inbox or enter a custom actor ID');
    return;
  }
  const scrollSnap = captureListScroll(e.inboxList);
  busy(e.refreshInbox, true, 'Loading…');
  if (!quiet) {
    const loading = commsListState({ loading: true, surface: 'inbox' });
    e.inboxList.innerHTML = `<p class="muted">${esc(loading.message)}</p>`;
  }
  try {
    const results = await Promise.all(recipients.map(async recipient => {
      try {
        const r = await mcpCall('cairnstone_get_inbox', { recipient_id: recipient, limit: 100 });
        return (r.messages || []).map(m => ({ ...m, for: recipient, recipient_id: recipient }));
      } catch {
        return [];
      }
    }));
    state.inbox = results.flat();
    rememberObservedIds([
      ...recipients,
      ...collectObservedIdsFromMessages(state.inbox)
    ]);
    updateStatsFromMessages(state.inbox);
    state.actorNav.inbox = normalizeInboxSelection(state.actorNav.inbox, state.actorNav.directory);
    renderAllActorNavigators();
    renderInbox();
    restoreListScroll(e.inboxList, scrollSnap);
    if (!quiet) toast(`${state.inbox.length} message${state.inbox.length === 1 ? '' : 's'}`);
  } catch (err) {
    const st = commsListState({ error: err, surface: 'inbox' });
    e.inboxList.innerHTML = `<p class="muted">${esc(st.message)}</p>`;
    if (!quiet) toast(err.message);
  } finally {
    busy(e.refreshInbox, false, 'Refresh');
  }
}

function messageRowHtml(row) {
  const unread = row.unread ? '● ' : '';
  const recipient = row.recipient_id ? `to ${esc(row.recipient_id)} · ` : '';
  const plane = mailboxPlaneBadge(row.recipient_id || row.for);
  const planeChip = plane
    ? `<span class="message-plane-chip" data-plane="${esc(plane.plane)}">${esc(plane.label)}</span>`
    : '';
  return `<div class="message-row-head"><span class="comms-intent-badge" data-intent="${esc(row.intent)}">${esc(row.intentLabel)}</span><strong>${unread}${esc(row.subject)}</strong>${planeChip}</div><div class="meta">${recipient}from ${esc(row.sender_id)} · ${esc(row.priority)} · ${esc(row.status || '')}</div><div class="meta">${esc(short(row.stone_hash))}${row.message_id ? ` · ${esc(short(row.message_id))}` : ''}</div>`;
}

function renderInbox() {
  const plane = state.actorNav.inbox.plane || 'all';
  const filtered = filterMessagesByPlane(state.inbox, plane);
  const empty = commsListState({ count: filtered.length, surface: 'inbox' });
  if (empty.status === 'empty') {
    e.inboxList.innerHTML = `<p class="muted">${esc(empty.message)}</p>`;
    return;
  }
  e.inboxList.innerHTML = '';
  const items = sortMessagesNewestFirst(filtered);
  const appendRow = (m) => {
    const row = normalizeMessageRow(m, { surface: 'inbox' });
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'message-item';
    b.innerHTML = messageRowHtml(row);
    b.addEventListener('click', () => readMessage(m, { source: 'inbox' }));
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

function setMessageReaderContent({ title, metaHtml, body }) {
  if (e.messageTitle) e.messageTitle.textContent = title;
  if (e.messageMeta) e.messageMeta.innerHTML = metaHtml || '';
  if (e.messageContent) e.messageContent.textContent = body;
  if (e.messageReaderSheetTitle) e.messageReaderSheetTitle.textContent = title;
  if (e.messageReaderSheetMeta) e.messageReaderSheetMeta.innerHTML = metaHtml || '';
  if (e.messageReaderSheetContent) e.messageReaderSheetContent.textContent = body;
}

function openMessageReaderFocus({ source = 'inbox', listEl } = {}) {
  state.messageReader = {
    source,
    scrollSnap: captureListScroll(listEl),
    returnPanel: state.activePanel,
    historyPushed: false,
    closingFromPopstate: false
  };
  openSheet(MESSAGE_READER_SHEET_ID);
  if (shouldPushReaderHistory(state.messageReader.historyPushed)) {
    try {
      history.pushState({ cairnstoneMessageReader: true }, '');
      state.messageReader.historyPushed = true;
    } catch {
      state.messageReader.historyPushed = false;
    }
  }
  focusReaderTitle(e.messageReaderSheetTitle);
}

function closeMessageReaderFocus({ fromPopstate = false } = {}) {
  const reader = state.messageReader || {};
  const sheetOpen = e.messageReaderSheet && !e.messageReaderSheet.classList.contains('hidden');
  if (!sheetOpen && !reader.historyPushed) {
    restoreListScroll(
      reader.scrollSnap?.listId ? $(reader.scrollSnap.listId) : null,
      reader.scrollSnap
    );
    return;
  }
  closeSheet(MESSAGE_READER_SHEET_ID);
  const listEl = reader.scrollSnap?.listId ? $(reader.scrollSnap.listId) : null;
  restoreListScroll(listEl, reader.scrollSnap);
  if (reader.returnPanel && state.activePanel !== reader.returnPanel) {
    panel(reader.returnPanel);
  }
  const pop = shouldPopReaderHistory({
    historyPushed: reader.historyPushed,
    fromPopstate
  });
  state.messageReader = {
    source: null,
    scrollSnap: null,
    returnPanel: null,
    historyPushed: false,
    closingFromPopstate: false
  };
  if (pop) {
    try { history.back(); } catch { /* ignore */ }
  }
}

function revealInlineMessageReader() {
  if (!e.messageReaderCard) return;
  scrollReaderIntoView(e.messageReaderCard, {
    stickyOffset: stickyChromeOffset()
  });
  focusReaderTitle(e.messageTitle);
}

async function readMessage(m, { source = 'inbox' } = {}) {
  const listEl = source === 'activity' ? e.activityList : e.inboxList;
  const useFocused = shouldUseFocusedReader();
  const loading = readerLoadingCopy();
  setMessageReaderContent({ title: loading.title, metaHtml: '', body: loading.body });

  if (useFocused) {
    openMessageReaderFocus({ source, listEl });
  } else {
    state.messageReader = {
      source,
      scrollSnap: captureListScroll(listEl),
      returnPanel: state.activePanel,
      historyPushed: false,
      closingFromPopstate: false
    };
    if (shouldNavigateToInboxForRead({ source, useFocusedReader: useFocused })) {
      panel('inbox');
    }
    // Immediate reveal while loading — do not wait for MCP round-trip.
    revealInlineMessageReader();
  }

  const recipient = m.for || m.recipient_id || e.inboxActor.value.trim();
  try {
    const r = await mcpCall('cairnstone_read_message', { recipient_id: recipient, message_id: m.message_id });
    const title = r.metadata?.subject || m.subject || 'Message';
    const metaHtml = [['from', r.metadata?.from || m.sender_id], ['to', recipient], ['intent', r.metadata?.intent || m.intent], ['thread', r.thread_id], ['message_id', m.message_id], ['stone', short(r.stone_hash)], ['scope', r.mutation_scope], ['exec_authority', 'none']].map(([k, v]) => chip(`${k}: ${v || '—'}`)).join('');
    const body = pretty(r.content);
    state.share.lastMessage = {
      ...m,
      message_id: m.message_id,
      stone_hash: r.stone_hash || m.stone_hash,
      subject: title,
      recipient_id: recipient
    };
    setMessageReaderContent({ title, metaHtml, body });
    setShareActionVisibility(true);
    // Quiet list refresh can restore prior windowY; re-reveal after so desktop never strands the reader.
    await refreshInbox({ quiet: true });
    if (source === 'activity') await refreshActivity({ quiet: true });
    if (useFocused) focusReaderTitle(e.messageReaderSheetTitle);
    else revealInlineMessageReader();
  } catch (err) {
    const fail = readerErrorCopy(err);
    setMessageReaderContent({ title: fail.title, metaHtml: '', body: fail.body });
    setShareActionVisibility(Boolean(state.share.lastMessage));
    if (useFocused) focusReaderTitle(e.messageReaderSheetTitle);
    else revealInlineMessageReader();
  }
}

async function handoff() {
  syncHandoffToFieldFromSelection();
  const to = e.handoffTo.value.split(',').map(v => v.trim()).filter(Boolean);
  const task = e.handoffTask.value.trim();
  const chain = e.handoffChain.value.trim();
  if (!chain || !to.length || !task) return toast('Associated chain, recipients, and task are required');
  if (!handoffChainAllowed(chain, state.scopeSnapshot?.chains || [])) {
    return toast('Handoff chain must be an exact participating chain in the current Scope');
  }

  rememberObservedIds(to);

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

async function refreshActivity({ quiet = false } = {}) {
  const actors = activityQueryRecipients();
  if (!actors.length) {
    if (!quiet) toast('Choose actors or enter a custom actor ID');
    return;
  }
  const scrollSnap = captureListScroll(e.activityList);
  busy(e.activityRefresh, true, 'Loading…');
  if (!quiet) {
    const loading = commsListState({ loading: true, surface: 'activity' });
    e.activityList.innerHTML = `<p class="muted">${esc(loading.message)}</p>`;
  }
  try {
    const results = await Promise.all(actors.map(async actor => {
      try {
        const r = await mcpCall('cairnstone_get_inbox', { recipient_id: actor, limit: 50 });
        return (r.messages || []).map(m => ({ ...m, for: actor, recipient_id: actor }));
      } catch {
        return [];
      }
    }));
    state.activity = results.flat();
    rememberObservedIds([
      ...actors,
      ...collectObservedIdsFromMessages(state.activity)
    ]);
    updateStatsFromMessages(state.activity);
    state.actorNav.activityKeys = normalizeMultiSelection(
      state.actorNav.activityKeys,
      state.actorNav.directory,
      { fallbackKeys: state.actorNav.activityKeys }
    );
    renderAllActorNavigators();
    renderActivity();
    restoreListScroll(e.activityList, scrollSnap);
    if (!quiet) toast(`${state.activity.length} activity item${state.activity.length === 1 ? '' : 's'} across ${actors.length} mailbox${actors.length === 1 ? '' : 'es'}`);
  } catch (err) {
    const st = commsListState({ error: err, surface: 'activity' });
    e.activityList.innerHTML = `<p class="muted">${esc(st.message)}</p>`;
    if (!quiet) toast(err.message);
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
  const recipient = m.for || m.recipient_id || e.inboxActor.value;
  if (recipient) {
    e.inboxActor.value = recipient;
    ingestCustomActorField(recipient, { into: 'inbox' });
  }
  await readMessage(m, { source: 'activity' });
}

async function refreshStones() {
  if (!state.scopeSnapshot) return toast('Resolve Scope first');
  busy(e.stonesRefresh, true, 'Loading…');
  if (e.stonesEmptyState) e.stonesEmptyState.classList.add('hidden');
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
    state.stones = [];
    e.stonesList.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    if (e.stonesEmptyState) {
      e.stonesEmptyState.classList.remove('hidden');
      e.stonesEmptyState.innerHTML = `<strong>Stones unavailable</strong><p class="muted small">${esc(err.message)}</p>`;
    }
    stonesDisclosureModel({ error: err, query: e.stonesQuery?.value || '' });
    toast(err.message);
  } finally {
    busy(e.stonesRefresh, false, 'Refresh');
  }
}

function renderStones() {
  const xs = state.stones || [];
  const model = stonesDisclosureModel({
    itemCount: xs.length,
    selected: Boolean(state.selectedStone),
    detailOpen: Boolean(e.stonesDetailBlock?.open),
    rawOpen: Boolean(e.stonesRawBlock?.open),
    query: e.stonesQuery?.value || ''
  });
  if (e.stonesEmptyState) {
    const showEmpty = model.status === 'empty';
    e.stonesEmptyState.classList.toggle('hidden', !showEmpty);
    if (showEmpty) {
      e.stonesEmptyState.innerHTML = `<strong>${esc(model.title)}</strong><p class="muted small">${esc(model.body)}</p>`;
    }
  }
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
    if (e.stoneDetailRaw) {
      e.stoneDetailRaw.textContent = JSON.stringify({
        kind: 'scope_match',
        chain: s.chain,
        path: s.path,
        stone_hash: s.stone_hash,
        authority_class: s.authority_class,
        ref_id: s.ref_id,
        commit_sha: s.commit_sha,
        note: 'stone_lod is storage LOD when present on stone payloads; response_lod is Answer Depth only.'
      }, null, 2);
    }
  } else {
    e.stoneDetailTitle.textContent = s.title || '(untitled)';
    e.stoneDetailMeta.innerHTML = [['Path', s.path || '—'], ['Repo', s.repo || '—'], ['Commit', s.commit ? s.commit.slice(0, 12) : '—'], ['HEAD', s.is_head ? 'yes' : 'no'], ['Author', s.author || '—'], ['Created', s.created_at ? new Date(s.created_at).toLocaleString() : '—']].map(([k, v]) => chip(`${k}: ${v}`)).join('');
    e.stoneDetailSummary.textContent = `LOD5: ${s.lod5 || '—'}\n\nLOD4: ${s.lod4 || '—'}`;
    if (e.stoneDetailRaw) {
      e.stoneDetailRaw.textContent = JSON.stringify({
        hash: s.hash,
        path: s.path,
        is_head: s.is_head,
        lod5: s.lod5,
        lod4: s.lod4,
        lod3: s.lod3,
        lod2: s.lod2,
        lod1: s.lod1,
        naming: 'stone_lod (lod5→lod1) ≠ response_lod (1→5 Answer Depth)'
      }, null, 2);
    }
  }
  if (e.stonesDetailBlock) e.stonesDetailBlock.open = true;
  e.copyStoneHash.disabled = !hash;
  setShareActionVisibility(Boolean(hash));
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
  if (e.universeGrid) e.universeGrid.classList.toggle('hidden', state.universeViewMode !== 'grid');
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
  syncAuthorizeDisclosure({ loading: true });
  try {
    const r = await operatorCall('/v1/tool-authorizations?limit=100');
    state.authorizations = r.authorizations || [];
    renderAuthorizations();
    toast(`${state.authorizations.length} authorization record${state.authorizations.length === 1 ? '' : 's'}`);
  } catch (err) {
    e.authorizationList.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    syncAuthorizeDisclosure({ error: err });
    toast(err.message);
  } finally {
    busy(e.authorizationRefresh, false, 'Refresh');
  }
}

function renderAuthorizations() {
  const tokenPresent = Boolean(e.operatorToken?.value?.trim());
  if (!state.authorizations.length) {
    e.authorizationList.innerHTML = '<p class="muted">No authorization history.</p>';
    syncAuthorizeDisclosure({ count: 0, tokenPresent });
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
  syncAuthorizeDisclosure({
    count: state.authorizations.length,
    tokenPresent,
    selected: Boolean(state.selectedAuthorization),
    pending: state.selectedAuthorization?.status === 'pending'
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
  if (e.authorizeArgsBlock) e.authorizeArgsBlock.open = true;
  if (e.authorizeRawBlock) e.authorizeRawBlock.open = false;
  syncAuthorizeDisclosure({
    count: state.authorizations.length,
    tokenPresent: Boolean(e.operatorToken?.value?.trim()),
    selected: true,
    pending,
    materialEffect: authorizationEffect(a),
    argsOpen: Boolean(e.authorizeArgsBlock?.open),
    rawOpen: Boolean(e.authorizeRawBlock?.open)
  });
}

function syncAuthorizeDisclosure(opts = {}) {
  const model = authorizeDisclosureModel({
    loading: Boolean(opts.loading),
    error: opts.error || null,
    count: opts.count ?? (state.authorizations?.length || 0),
    selected: opts.selected ?? Boolean(state.selectedAuthorization),
    pending: opts.pending ?? (state.selectedAuthorization?.status === 'pending'),
    tokenPresent: opts.tokenPresent ?? Boolean(e.operatorToken?.value?.trim()),
    argsOpen: opts.argsOpen ?? Boolean(e.authorizeArgsBlock?.open),
    rawOpen: opts.rawOpen ?? Boolean(e.authorizeRawBlock?.open),
    materialEffect: opts.materialEffect || ''
  });
  if (e.authorizationEmptyState) {
    const show = model.status === 'empty' || model.status === 'disabled' || model.status === 'error';
    e.authorizationEmptyState.classList.toggle('hidden', !show || (model.status === 'ready'));
    if (show && model.status !== 'ready') {
      e.authorizationEmptyState.innerHTML = `<strong>${esc(model.title)}</strong><p class="muted small">${esc(model.body)}</p>`;
    }
  }
  return model;
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

/* —— V7.7.10b Give Access / Assign / Forward (presentation) —— */

function currentSharePrincipalId() {
  const custom = (e.sharePrincipal?.value || state.share.customPrincipal || '').trim();
  if (custom) return custom;
  const actor = actorByKey(state.share.principalKey);
  const ids = defaultHandoffRecipients(actor);
  return ids[0] || '';
}

function renderShareActorPicker() {
  if (e.shareActorNavLabel) e.shareActorNavLabel.textContent = 'Choose principal';
  renderActorPicker(e.shareActorPicker, {
    mode: 'single',
    selectedKeys: state.share.principalKey ? [state.share.principalKey] : [],
    onSelect: (key) => {
      state.share.principalKey = key;
      state.share.customPrincipal = '';
      const actor = actorByKey(key);
      const ids = defaultHandoffRecipients(actor);
      if (e.sharePrincipal) e.sharePrincipal.value = ids[0] || '';
      if (e.shareActorMeta) {
        e.shareActorMeta.textContent = ids.length
          ? `${actor?.display || key} → ${ids.join(', ')}`
          : 'No work mailbox for this actor';
      }
      refreshShareProposal();
    }
  });
  if (e.shareActorMeta && state.share.principalKey) {
    const actor = actorByKey(state.share.principalKey);
    const ids = defaultHandoffRecipients(actor);
    e.shareActorMeta.textContent = ids.length
      ? `${actor?.display || state.share.principalKey} → ${ids.join(', ')}`
      : 'No work mailbox for this actor';
  }
}

function setShareModeUi(mode) {
  const m = mode || 'give-access';
  state.share.mode = m;
  if (e.shareSheetTitle) e.shareSheetTitle.textContent = shareModeLabel(m);
  document.querySelectorAll('.share-mode-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.shareTab === m);
  });
  if (e.shareGiveFields) e.shareGiveFields.classList.toggle('hidden', m !== 'give-access');
  if (e.shareAssignFields) e.shareAssignFields.classList.toggle('hidden', m !== 'assign');
  if (e.shareForwardFields) e.shareForwardFields.classList.toggle('hidden', m !== 'forward');
  refreshShareProposal();
}

function buildCurrentShareProposal() {
  const objectRef = state.share.object?.object_ref;
  const principal = currentSharePrincipalId();
  const grantor = (e.actorId?.value || '').trim() || 'console:jared';
  const mode = state.share.mode;
  if (mode === 'give-access') {
    return buildAccessGrantProposal({
      object_ref: objectRef,
      principal_actor_id: principal,
      permission: e.sharePermission?.value || 'read',
      grantor_actor_id: grantor,
      notify: Boolean(e.shareNotify?.checked)
    });
  }
  if (mode === 'assign') {
    const refs = [objectRef, ...(state.share.object?.secondary_refs || [])].filter(Boolean);
    return buildAssignProposal({
      object_refs: refs,
      assignee_actor_id: principal,
      requester_actor_id: grantor,
      task: e.shareAssignTask?.value || ''
    });
  }
  return buildForwardWithNotePayload({
    from: grantor,
    to: [principal].filter(Boolean),
    note: e.shareForwardNote?.value || '',
    original_object_ref: objectRef,
    subject: e.shareForwardSubject?.value || 'Forward with note',
    preferForwardTool: true,
    forwardToolAvailable: workerHasTool(ACCESS_GRANT_TOOLS.forwardWithNote)
  });
}

function refreshShareProposal() {
  const proposal = buildCurrentShareProposal();
  state.share.proposal = proposal;
  const card = summarizeProposalCard(proposal);
  if (e.shareProposalTitle) e.shareProposalTitle.textContent = card.title;
  if (e.shareProposalLines) {
    e.shareProposalLines.innerHTML = card.lines.map(line => `<li>${esc(line)}</li>`).join('');
  }
  const committed = Boolean(e.shareHumanCommit?.checked);
  if (e.shareCommitButton) e.shareCommitButton.disabled = !(proposal.ok && committed);
  if (e.sharePermission && state.share.mode === 'give-access') {
    const perm = e.sharePermission.value;
    if (e.shareSheetBlurb) {
      e.shareSheetBlurb.textContent = `${permissionLabel(perm)} Human Commit required. Does not duplicate the canonical payload. Presentation never moves HEADs.`;
    }
  }
}

function setShareActionVisibility(hasObject) {
  const show = Boolean(hasObject);
  [e.messageShareActions, e.messageReaderSheetShareActions, e.evidenceShareActions, e.evidenceDrawerShareActions]
    .forEach(el => { if (el) el.hidden = !show; });
  [e.stoneGiveAccess, e.stoneAssign, e.stoneForward].forEach(btn => {
    if (btn) btn.disabled = !show;
  });
}

async function hydrateShareObjectResolve(objectRef) {
  const local = localResolveAttachment(objectRef);
  if (e.shareResolveNote) {
    e.shareResolveNote.textContent = local.ok
      ? local.note
      : (local.message || 'Unrecognized object ref');
  }
  const actor_id = (e.actorId?.value || '').trim() || undefined;
  const resolveArgs = buildAttachmentResolveArgs({ object_ref: objectRef, actor_id });
  try {
    const known = workerHasTool(ACCESS_GRANT_TOOLS.attachmentResolve);
    if (known === false) {
      const honesty = toolMissingHonesty(ACCESS_GRANT_TOOLS.attachmentResolve);
      if (e.shareResolveNote) e.shareResolveNote.textContent = honesty.body;
      return { ...local, worker_available: false };
    }
    const r = await mcpCall(ACCESS_GRANT_TOOLS.attachmentResolve, resolveArgs);
    if (e.shareResolveNote) {
      e.shareResolveNote.textContent = r?.summary || r?.note || 'Resolved via cairnstone_attachment_ref_resolve';
    }
    return r;
  } catch (err) {
    if (isToolMissingError(err)) {
      const honesty = toolMissingHonesty(ACCESS_GRANT_TOOLS.attachmentResolve);
      if (e.shareResolveNote) e.shareResolveNote.textContent = honesty.body;
      return { ...local, worker_available: false };
    }
    if (e.shareResolveNote) e.shareResolveNote.textContent = `Resolve failed: ${err.message}`;
    return local;
  }
}

async function openShareSheet({ mode = 'give-access', source = null, object = null } = {}) {
  if (!object?.object_ref) {
    toast('Select a message, stone, response, or Code Session first');
    return;
  }
  state.share.source = source;
  state.share.object = object;
  if (!state.share.principalKey) {
    state.share.principalKey = state.actorNav.handoffKeys[0] || state.actorNav.inbox.actorKey || 'claude';
  }
  const actor = actorByKey(state.share.principalKey);
  const ids = defaultHandoffRecipients(actor);
  if (e.sharePrincipal && !e.sharePrincipal.value) e.sharePrincipal.value = ids[0] || '';
  if (e.shareObjectRef) e.shareObjectRef.textContent = object.object_ref;
  if (e.shareObjectMeta) {
    const chips = [
      chip(`kind: ${object.kind || '—'}`),
      chip(`source: ${object.source || source || '—'}`),
      ...(object.secondary_refs || []).map(r => chip(r))
    ];
    e.shareObjectMeta.innerHTML = chips.join('');
  }
  if (e.shareHumanCommit) e.shareHumanCommit.checked = false;
  if (e.shareResult) e.shareResult.textContent = 'No share action committed yet.';
  setShareModeUi(mode);
  renderShareActorPicker();
  openSheet('shareSheet');
  hydrateShareObjectResolve(object.object_ref).catch(() => {});
}

function shareObjectFromSource(source) {
  if (source === 'message-reader' || source === 'inbox') {
    return state.share.lastMessage ? objectRefFromMessage(state.share.lastMessage) : null;
  }
  if (source === 'stones') return state.selectedStone ? objectRefFromStone(state.selectedStone) : null;
  if (source === 'evidence') return state.lastResult ? objectRefFromResponse(state.lastResult) : null;
  if (source === 'work') {
    const sid = currentCodeSessionId();
    return sid ? objectRefFromCodeSession(sid) : null;
  }
  return state.share.object;
}

async function commitShareAction() {
  const proposal = buildCurrentShareProposal();
  state.share.proposal = proposal;
  refreshShareProposal();
  if (!proposal.ok) {
    toast(proposal.errors[0] || 'Incomplete proposal');
    return;
  }
  if (!e.shareHumanCommit?.checked) {
    toast('Human Commit required');
    return;
  }
  busy(e.shareCommitButton, true, 'Committing…');
  try {
    let tool = proposal.mcp_tool;
    let args = mcpArgsFromProposal(proposal);

    // Forward: prefer forward_with_note; fall back to send_message if catalog lacks it.
    if (proposal.operation === 'forward-with-note') {
      const hasForward = workerHasTool(ACCESS_GRANT_TOOLS.forwardWithNote);
      if (hasForward === false) {
        const fallback = buildForwardWithNotePayload({
          from: proposal.mcpArgs?.from || (e.actorId?.value || '').trim(),
          to: proposal.mcpArgs?.to,
          note: proposal.mcpArgs?.note || e.shareForwardNote?.value || '',
          original_object_ref: proposal.mcpArgs?.object_ref || state.share.object?.object_ref,
          subject: proposal.mcpArgs?.subject || e.shareForwardSubject?.value || 'Forward with note',
          preferForwardTool: false,
          forwardToolAvailable: false
        });
        tool = fallback.mcp_tool;
        args = mcpArgsFromProposal(fallback);
      }
    }

    const known = workerHasTool(tool);
    if (known === false) {
      const honesty = toolMissingHonesty(tool);
      const payload = {
        ok: false,
        ...honesty,
        proposal: {
          operation: proposal.operation,
          mcp_tool: tool,
          args,
          human_commit_required: true,
          human_commit_recorded: true,
          note: 'Human Commit checked in Console; worker catalog does not include this tool yet.'
        }
      };
      if (e.shareResult) e.shareResult.textContent = JSON.stringify(payload, null, 2);
      toast(honesty.title);
      return;
    }
    const r = await mcpCall(tool, args);
    if (e.shareResult) e.shareResult.textContent = JSON.stringify(r, null, 2);
    toast(proposal.operation === 'forward-with-note' ? 'Forwarded with note' : 'Committed');
    if (proposal.operation === 'grant' && e.accessGrantsObjectRef && state.share.object?.object_ref) {
      e.accessGrantsObjectRef.value = state.share.object.object_ref;
    }
  } catch (err) {
    if (isToolMissingError(err)) {
      const honesty = toolMissingHonesty(proposal.mcp_tool);
      const payload = {
        ok: false,
        ...honesty,
        proposal: {
          operation: proposal.operation,
          mcp_tool: proposal.mcp_tool,
          args: mcpArgsFromProposal(proposal),
          human_commit_required: true,
          note: 'Commit acknowledged in Console; worker tool not available yet.'
        },
        error: err.message,
        error_payload: err.payload || null
      };
      if (e.shareResult) e.shareResult.textContent = JSON.stringify(payload, null, 2);
      toast(honesty.title);
    } else {
      if (e.shareResult) e.shareResult.textContent = JSON.stringify(err.payload || { error: err.message }, null, 2);
      toast(err.message);
    }
  } finally {
    busy(e.shareCommitButton, false, 'Commit');
    refreshShareProposal();
  }
}

function setIntentResult(payload) {
  if (!e.intentResult) return;
  if (typeof payload === 'string') {
    e.intentResult.textContent = payload;
    return;
  }
  e.intentResult.textContent = JSON.stringify(payload || {}, null, 2);
}

function setEventResult(card) {
  if (!e.eventResult) return;
  e.eventResult.textContent = summarizeEventCard(card);
}

function setRetentionResult(card) {
  if (!e.retentionResult) return;
  e.retentionResult.textContent = summarizeRetentionCard(card);
}

function intentToolUnavailablePayload(tool) {
  return {
    ok: false,
    error: 'tool_not_available',
    tool,
    available: false,
    accepted_state_authority: false
  };
}

async function pollWorkerEvents() {
  const args = buildEventListArgs({
    actor_id: (e.actorId?.value || 'console:jared').trim(),
    task_run_id: (e.eventTaskRunId?.value || '').trim(),
    limit: 25
  });
  busy(e.eventPollButton, true, 'Polling…');
  try {
    if (workerHasTool(EVENT_LIST_TOOL) === false) {
      const card = compileEventListCard({}, { toolsAvailable: false });
      setEventResult(card);
      toast('Event list tool is not available');
      return;
    }
    const result = await mcpCall(EVENT_LIST_TOOL, args);
    setEventResult(compileEventListCard(result, { toolsAvailable: true }));
    toast('Worker events polled');
  } catch (err) {
    if (isToolMissingError(err)) {
      const card = compileEventListCard(err.payload || {}, { toolsAvailable: false });
      setEventResult(card);
      toast('Event list tool is not available');
      return;
    }
    setEventResult(compileEventListCard(err.payload || { ok: false, error: err.message }, { toolsAvailable: true }));
    toast(err.message);
  } finally {
    busy(e.eventPollButton, false, 'Poll events');
  }
}

async function pollWorkerAgentTree() {
  const args = buildAgentTreeArgs({
    actor_id: (e.actorId?.value || 'console:jared').trim(),
    root_task_run_id: (e.eventTaskRunId?.value || '').trim(),
    limit: 50
  });
  busy(e.eventTreeButton, true, 'Polling…');
  try {
    if (workerHasTool(AGENT_TREE_TOOL) === false) {
      const card = compileAgentTreeCard({}, { toolsAvailable: false });
      setEventResult(card);
      toast('Agent tree tool is not available');
      return;
    }
    const result = await mcpCall(AGENT_TREE_TOOL, args);
    setEventResult(compileAgentTreeCard(result, { toolsAvailable: true }));
    toast('Agent tree polled');
  } catch (err) {
    if (isToolMissingError(err)) {
      const card = compileAgentTreeCard(err.payload || {}, { toolsAvailable: false });
      setEventResult(card);
      toast('Agent tree tool is not available');
      return;
    }
    setEventResult(compileAgentTreeCard(err.payload || { ok: false, error: err.message }, { toolsAvailable: true }));
    toast(err.message);
  } finally {
    busy(e.eventTreeButton, false, 'Poll agent tree');
  }
}

async function previewContextRetention() {
  const args = buildPreviewArgs({
    actor_id: (e.actorId?.value || 'console:jared').trim(),
    candidates: SAMPLE_RETENTION_CANDIDATES
  });
  busy(e.retentionPreviewButton, true, 'Previewing…');
  try {
    if (workerHasTool(PREVIEW_TOOL) === false) {
      const card = compileRetentionCard({}, { toolsAvailable: false });
      setRetentionResult(card);
      toast('Retention preview tool is not available');
      return;
    }
    const result = await mcpCall(PREVIEW_TOOL, args);
    setRetentionResult(compileRetentionCard(result, { toolsAvailable: true }));
    toast('Retention preview ready');
  } catch (err) {
    if (isToolMissingError(err)) {
      const card = compileRetentionCard(err.payload || { ok: false, error: 'tool_unavailable' }, { toolsAvailable: false });
      setRetentionResult(card);
      toast('Retention preview tool is not available');
      return;
    }
    setRetentionResult(compileRetentionCard(err.payload || { ok: false, error: err.message }, { toolsAvailable: true }));
    toast(err.message || 'Retention preview failed');
  } finally {
    busy(e.retentionPreviewButton, false, 'Preview retention');
  }
}

function refreshIntentSummary(card = state.intent.dispatchCard || state.intent.proposalCard) {
  const summary = summarizeIntentCard(card);
  if (e.intentProposalTitle) e.intentProposalTitle.textContent = summary.title;
  if (e.intentProposalLines) {
    e.intentProposalLines.innerHTML = summary.lines.map(line => `<li>${esc(line)}</li>`).join('');
  }
}

function refreshIntentControls() {
  refreshIntentSummary();
  const requiresHumanCommit = state.intent.proposalCard?.require_human_commit === true;
  const canCommitProposal = Boolean(state.intent.proposalCard?.proposal?.mcp_tool)
    && (!requiresHumanCommit || Boolean(e.intentHumanCommit?.checked));
  if (e.intentCommitProposal) e.intentCommitProposal.disabled = !canCommitProposal;
  const taskRunId = (e.dispatchTaskRunId?.value || '').trim();
  const built = buildDispatchCommitArgs({
    task_run_id: taskRunId,
    human_commit: Boolean(e.dispatchHumanCommit?.checked),
    committed_by: (e.actorId?.value || 'console:jared').trim()
  });
  const dispatchCard = state.intent.dispatchCard;
  const hasVerifiedDispatch = Boolean(
    taskRunId
    && dispatchCard?.task_run_id === taskRunId
    && dispatchCard.dispatchable === true
  );
  if (e.dispatchCommitButton) e.dispatchCommitButton.disabled = !built.ok || !hasVerifiedDispatch;
}

async function routeConsoleIntent() {
  const prepared = buildIntentRouteArgs({
    text: e.intentText?.value || '',
    actor_id: (e.actorId?.value || 'console:jared').trim(),
    code_session_id: (e.codeSessionId?.value || currentCodeSessionId() || '').trim()
  });
  if (!prepared.ok) {
    setIntentResult({ ok: false, error: 'invalid_route_args', errors: prepared.errors, accepted_state_authority: false });
    toast(prepared.errors[0] || 'Intent text is required');
    refreshIntentControls();
    return;
  }
  busy(e.intentRouteButton, true, 'Routing…');
  try {
    if (workerHasTool(INTENT_TOOLS.route) === false) {
      setIntentResult(intentToolUnavailablePayload(INTENT_TOOLS.route));
      toast('Intent route tool is not available');
      return;
    }
    const routed = await mcpCall(INTENT_TOOLS.route, prepared.args);
    const priorDispatchCard = state.intent.dispatchCard;
    const priorDispatchTaskRunId = (e.dispatchTaskRunId?.value || '').trim();
    state.intent.routeResult = routed;
    state.intent.proposalCard = compileIntentProposalCard(routed);
    state.intent.dispatchCard = priorDispatchCard;
    if (e.intentHumanCommit) e.intentHumanCommit.checked = false;
    if (e.dispatchHumanCommit) e.dispatchHumanCommit.checked = false;
    if (e.dispatchTaskRunId && !e.dispatchTaskRunId.value) e.dispatchTaskRunId.value = priorDispatchTaskRunId;
    setIntentResult(routed);
    window.dispatchEvent(new CustomEvent('cairn:work-proposal-ready', {
      detail: { intent: state.intent.proposalCard?.intent || null, ok: state.intent.proposalCard?.ok !== false }
    }));
    toast(state.intent.proposalCard.intent === 'none' ? 'No consequential intent matched' : 'Intent routed');
  } catch (err) {
    setIntentResult(err.payload || { ok: false, error: err.message, accepted_state_authority: false });
    toast(err.message);
  } finally {
    busy(e.intentRouteButton, false, 'Route intent');
    refreshIntentControls();
  }
}

async function commitConsoleProposal() {
  const proposal = commitProposalTool(state.intent.proposalCard, {
    human_commit: Boolean(e.intentHumanCommit?.checked),
    committed_by: (e.actorId?.value || 'console:jared').trim()
  });
  if (!proposal.ok) {
    setIntentResult(proposal);
    if (proposal.error === 'human_commit_required') toast('Human Commit required');
    else if (proposal.error === 'committed_by_required') toast('Actor ID / committed_by is required');
    else if (proposal.error === 'proposal_not_ready') toast('Proposal is not ready to commit');
    else toast('No proposal to commit');
    refreshIntentControls();
    return;
  }
  busy(e.intentCommitProposal, true, 'Committing…');
  try {
    if (workerHasTool(proposal.mcp_tool) === false) {
      const payload = intentToolUnavailablePayload(proposal.mcp_tool);
      payload.proposal = proposal;
      setIntentResult(payload);
      toast('Proposal tool is not available');
      return;
    }
    const committed = await mcpCall(proposal.mcp_tool, proposal.args);
    const taskRunId = String(
      committed.task_run_id
      || committed.task_run?.task_run_id
      || proposal.args.task_run_id
      || state.intent.proposalCard?.task_run_id
      || ''
    ).trim();
    if (e.dispatchTaskRunId && taskRunId) e.dispatchTaskRunId.value = taskRunId;
    state.intent.dispatchCard = taskRunId
      ? compileDispatchCommitCard({
        ...committed,
        task_run_id: taskRunId,
        status: committed.status || committed.task_run?.status || 'proposed'
      })
      : null;
    if (e.dispatchHumanCommit) e.dispatchHumanCommit.checked = false;
    setIntentResult(committed);
    window.dispatchEvent(new CustomEvent('cairn:work-proposal-committed'));
    toast('Proposal committed');
  } catch (err) {
    setIntentResult(err.payload || { ok: false, error: err.message, accepted_state_authority: false });
    toast(err.message);
  } finally {
    busy(e.intentCommitProposal, false, 'Commit proposal');
    refreshIntentControls();
  }
}

async function commitConsoleDispatch() {
  const taskRunId = (e.dispatchTaskRunId?.value || '').trim();
  const dispatchCard = state.intent.dispatchCard;
  if (!taskRunId || dispatchCard?.task_run_id !== taskRunId || dispatchCard.dispatchable !== true) {
    setIntentResult({
      ok: false,
      error: 'task_run_not_dispatchable',
      task_run_id: taskRunId,
      status: dispatchCard?.status || null,
      accepted_state_authority: false
    });
    toast('Route and commit a proposed Task Run before dispatch');
    window.dispatchEvent(new CustomEvent('cairn:work-dispatched'));
    refreshIntentControls();
    return;
  }
  const prepared = buildDispatchCommitArgs({
    task_run_id: taskRunId,
    human_commit: Boolean(e.dispatchHumanCommit?.checked),
    committed_by: (e.actorId?.value || 'console:jared').trim()
  });
  if (!prepared.ok) {
    setIntentResult({ ok: false, error: 'invalid_dispatch_args', errors: prepared.errors, accepted_state_authority: false });
    toast(prepared.errors[0] || 'Dispatch Human Commit required');
    refreshIntentControls();
    return;
  }
  busy(e.dispatchCommitButton, true, 'Dispatching…');
  try {
    if (workerHasTool(INTENT_TOOLS.dispatch) === false) {
      const payload = intentToolUnavailablePayload(INTENT_TOOLS.dispatch);
      payload.dispatch = prepared.args;
      setIntentResult(payload);
      toast('Dispatch tool is not available');
      return;
    }
    const dispatched = await mcpCall(INTENT_TOOLS.dispatch, prepared.args);
    state.intent.dispatchCard = compileDispatchCommitCard({
      ...dispatched,
      task_run_id: prepared.args.task_run_id,
      status: dispatched.status || dispatched.task_run?.status || 'queued'
    });
    setIntentResult(dispatched);
    toast('Task Run dispatched');
  } catch (err) {
    setIntentResult(err.payload || { ok: false, error: err.message, accepted_state_authority: false });
    toast(err.message);
  } finally {
    busy(e.dispatchCommitButton, false, 'Dispatch Task Run');
    refreshIntentControls();
  }
}

async function refreshAccessGrants() {
  const objectRef = (e.accessGrantsObjectRef?.value || '').trim() || undefined;
  const actor_id = (e.actorId?.value || '').trim() || 'console:jared';
  if (e.accessGrantsHonesty) e.accessGrantsHonesty.textContent = 'Loading grants…';
  busy(e.accessGrantsRefresh, true, 'Loading…');
  try {
    const r = await mcpCall(ACCESS_GRANT_TOOLS.list, sanitizeMcpArgs(ACCESS_GRANT_TOOLS.list, {
      actor_id,
      object_ref: objectRef,
      limit: 50
    }));
    state.share.grants = r.grants || r.items || [];
    renderAccessGrants();
    if (e.accessGrantsHonesty) {
      e.accessGrantsHonesty.textContent = `${state.share.grants.length} grant${state.share.grants.length === 1 ? '' : 's'} · lifecycle granted → first_read → revoked (future access only)`;
    }
  } catch (err) {
    if (isToolMissingError(err)) {
      const honesty = toolMissingHonesty(ACCESS_GRANT_TOOLS.list);
      state.share.grants = [];
      if (e.accessGrantsList) {
        e.accessGrantsList.innerHTML = `<p class="muted"><strong>${esc(honesty.title)}</strong><br>${esc(honesty.body)}</p>`;
      }
      if (e.accessGrantsHonesty) e.accessGrantsHonesty.textContent = honesty.body;
    } else {
      if (e.accessGrantsList) e.accessGrantsList.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
      if (e.accessGrantsHonesty) e.accessGrantsHonesty.textContent = err.message;
      toast(err.message);
    }
  } finally {
    busy(e.accessGrantsRefresh, false, 'Refresh');
  }
}

function renderAccessGrants() {
  if (!e.accessGrantsList) return;
  const rows = state.share.grants || [];
  if (!rows.length) {
    e.accessGrantsList.innerHTML = '<p class="muted">No grants returned.</p>';
    return;
  }
  e.accessGrantsList.innerHTML = '';
  for (const g of rows) {
    const b = document.createElement('div');
    b.className = 'message-item access-grant-row';
    const status = grantStatusLabel(g.status || g.lifecycle || 'granted');
    b.innerHTML = `<strong>${esc(g.object_ref || '—')}</strong>
      <div class="meta">${esc(g.principal_actor_id || '—')} · ${esc(g.permission || '—')} · ${esc(status)}</div>
      <div class="meta">${esc(g.grant_id || '')}${g.first_read_at ? ` · first_read ${esc(g.first_read_at)}` : ''}${g.revoked_at ? ` · revoked ${esc(g.revoked_at)}` : ''}</div>
      <div class="share-actions">
        <button type="button" class="secondary" data-revoke-grant="${esc(g.grant_id || '')}" ${g.status === 'revoked' || !g.grant_id ? 'disabled' : ''}>Revoke…</button>
      </div>`;
    e.accessGrantsList.append(b);
  }
  e.accessGrantsList.querySelectorAll('[data-revoke-grant]').forEach(btn => {
    btn.addEventListener('click', () => revokeGrantWithCommit(btn.getAttribute('data-revoke-grant')));
  });
}

async function revokeGrantWithCommit(grantId) {
  const proposal = buildRevokeProposal({
    grant_id: grantId,
    actor_id: (e.actorId?.value || '').trim() || 'console:jared'
  });
  if (!proposal.ok) return toast(proposal.errors[0] || 'Cannot revoke');
  const ok = globalThis.confirm?.(
    `${proposal.summary}\n\nHuman Commit required. Revoke blocks future access only — it does not erase data already read.`
  );
  if (!ok) return;
  try {
    const r = await mcpCall(proposal.mcp_tool, mcpArgsFromProposal(proposal));
    toast('Grant revoked (future access only)');
    await refreshAccessGrants();
    if (e.shareResult) e.shareResult.textContent = JSON.stringify(r, null, 2);
  } catch (err) {
    if (isToolMissingError(err)) {
      toast(toolMissingHonesty(ACCESS_GRANT_TOOLS.revoke).title);
      if (e.accessGrantsHonesty) e.accessGrantsHonesty.textContent = toolMissingHonesty(ACCESS_GRANT_TOOLS.revoke).body;
    } else toast(err.message);
  }
}

function panel(name) {
  const panelName = name === 'work' ? 'code' : name;
  const primary = PRIMARY_BY_PANEL[panelName] || 'chat';
  state.activePanel = panelName;
  document.querySelectorAll('.nav-item').forEach(t => {
    const active = t.dataset.nav === primary;
    t.classList.toggle('active', active);
    if (active) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${panelName}`));
  if (e.inboxSubnav) e.inboxSubnav.classList.toggle('hidden', primary !== 'inbox');
  if (e.moreSubnav) e.moreSubnav.classList.toggle('hidden', primary !== 'more');
  document.querySelectorAll('#inboxSubnav .subnav-item, #moreSubnav .subnav-item').forEach(t => {
    const active = t.dataset.panel === panelName;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (primary === 'more') syncSettingsPreview();
  if (panelName === 'universe') syncUniverseLanding();
  if (primary === 'inbox') syncCommsHub(panelName);
  if (panelName === 'authorize') syncAuthorizeDisclosure();
  if (panelName === 'evidence') renderEvidence(state.lastResult);
  if (panelName === 'access') {
    if (e.accessGrantsHonesty && !state.share.grants.length) {
      e.accessGrantsHonesty.textContent = 'Refresh to list grants when cairnstone_access_grant_list is available (worker 0.5.40+).';
    }
  }
  syncSavedViewsContextLabel();
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
  if (id === 'savedViewsSheet') renderSavedViewsList();
}

function closeSheet(id) {
  const el = typeof id === 'string' ? $(id) : id;
  if (!el) return;
  el.classList.add('hidden');
  const openSheets = [e.scopeSheet, e.runtimeSheet, e.chatConfigSheet, e.evidenceDrawer, e.savedViewsSheet, e.messageReaderSheet, e.shareSheet]
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
  if (e.contextChatLabel) {
    const tid = state.chatThreadId || (typeof ensureChatThreadId === 'function' ? ensureChatThreadId() : '');
    e.contextChatLabel.textContent = tid ? short(tid) : '—';
  }
  if (e.contextCodeLabel || e.contextCodeBtn) {
    const sid = currentCodeSessionId();
    if (e.contextCodeLabel) e.contextCodeLabel.textContent = sid ? short(sid) : '—';
    if (e.contextCodeBtn) e.contextCodeBtn.classList.toggle('hidden', !sid);
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

function syncSavedViewsContextLabel() {
  const n = listSavedViewSummaries().length;
  if (e.contextViewsLabel) e.contextViewsLabel.textContent = n ? `${n} saved` : 'Save / open';
}

function currentDisclosurePrefs() {
  const evidenceSectionsOpen = [...document.querySelectorAll('#evidenceDisclosure details[data-evidence-section]')]
    .filter(el => el.open)
    .map(el => el.dataset.evidenceSection);
  return {
    scopePickerOpen: Boolean(e.scopePicker?.open),
    scopeAdvancedOpen: Boolean(e.scopeAdvanced?.open),
    stonesDetailOpen: Boolean(e.stonesDetailBlock?.open),
    stonesRawOpen: Boolean(e.stonesRawBlock?.open),
    authorizeArgsOpen: Boolean(e.authorizeArgsBlock?.open),
    authorizeRawOpen: Boolean(e.authorizeRawBlock?.open),
    workSectionsOpen: workDisclosurePrefsFromDom($('codeDisclosure')),
    evidenceSectionsOpen
  };
}

function applyDisclosurePrefs(disclosure = {}) {
  if (e.scopePicker && typeof disclosure.scopePickerOpen === 'boolean') e.scopePicker.open = disclosure.scopePickerOpen;
  if (e.scopeAdvanced && typeof disclosure.scopeAdvancedOpen === 'boolean') e.scopeAdvanced.open = disclosure.scopeAdvancedOpen;
  if (e.stonesDetailBlock && typeof disclosure.stonesDetailOpen === 'boolean') e.stonesDetailBlock.open = disclosure.stonesDetailOpen;
  if (e.stonesRawBlock && typeof disclosure.stonesRawOpen === 'boolean') e.stonesRawBlock.open = disclosure.stonesRawOpen;
  if (e.authorizeArgsBlock && typeof disclosure.authorizeArgsOpen === 'boolean') e.authorizeArgsBlock.open = disclosure.authorizeArgsOpen;
  if (e.authorizeRawBlock && typeof disclosure.authorizeRawOpen === 'boolean') e.authorizeRawBlock.open = disclosure.authorizeRawOpen;
  if (Array.isArray(disclosure.workSectionsOpen)) {
    applyWorkDisclosurePrefs($('codeDisclosure'), disclosure.workSectionsOpen);
  }
  if (Array.isArray(disclosure.evidenceSectionsOpen)) {
    const want = new Set(disclosure.evidenceSectionsOpen);
    document.querySelectorAll('#evidenceDisclosure details[data-evidence-section]').forEach(el => {
      el.open = want.has(el.dataset.evidenceSection);
    });
  }
}

function applySavedViewPresentation(p) {
  if (p.filters?.stonesQuery != null && e.stonesQuery) e.stonesQuery.value = p.filters.stonesQuery;
  if (p.filters?.universeSearch != null && e.universeSearch) e.universeSearch.value = p.filters.universeSearch;
  if (p.filters?.scopeSearch != null && e.scopeSearch) e.scopeSearch.value = p.filters.scopeSearch;
  if (p.filters?.activityFilter != null && e.activityFilter) e.activityFilter.value = p.filters.activityFilter;
  state.universeLod = normalizeZoom(p.universeLod || 'vault');
  state.universeViewMode = normalizeViewMode(p.universeViewMode || 'spatial');
  applyDisclosurePrefs(p.disclosure || {});
  panel(p.panel || 'chat');
  if ((p.panel || p.primary) === 'universe' || p.primary === 'universe') {
    // Landing stays; overlay opens only if already open or user opens Bird's Eye.
    syncUniverseLanding();
  }
}

function showSavedViewFreshness(freshness) {
  state.savedViewFreshness = freshness || null;
  if (!e.savedViewFreshness) return;
  if (!freshness) {
    e.savedViewFreshness.classList.add('hidden');
    e.savedViewFreshness.textContent = '';
    return;
  }
  e.savedViewFreshness.classList.remove('hidden');
  e.savedViewFreshness.textContent = freshness.message || 'Scope re-resolved on open. Saved View is not accepted-state.';
}

function renderSavedViewsList() {
  if (!e.savedViewsList) return;
  const store = loadSavedViewsStore();
  if (!store.views.length) {
    e.savedViewsList.innerHTML = '<p class="muted">No Saved Views yet. Save the current surface + Scope selectors (presentation only).</p>';
    syncSavedViewsContextLabel();
    return;
  }
  e.savedViewsList.innerHTML = '';
  store.views.forEach(v => {
    const row = document.createElement('div');
    row.className = 'message-item';
    row.innerHTML = `<strong>${esc(v.name)}</strong>
      <div class="meta">${esc(v.presentation.primary)} · ${esc(v.presentation.panel)} · Scope ${esc(v.scopeSelector.mode)}${v.presentation.universeLod ? ` · LOD ${esc(v.presentation.universeLod)}` : ''}</div>
      <div class="meta">Updated ${esc(v.updated_at ? new Date(v.updated_at).toLocaleString() : '—')} · selectors only</div>
      <div class="saved-view-row-actions">
        <button class="primary" type="button" data-open-view="${esc(v.id)}">Open</button>
        <button class="secondary" type="button" data-delete-view="${esc(v.id)}">Delete</button>
      </div>`;
    row.querySelector('[data-open-view]')?.addEventListener('click', () => openSavedViewById(v.id));
    row.querySelector('[data-delete-view]')?.addEventListener('click', () => {
      deleteSavedView(v.id);
      renderSavedViewsList();
      toast('Saved View deleted');
    });
    e.savedViewsList.append(row);
  });
  syncSavedViewsContextLabel();
}

function saveCurrentSavedView() {
  const name = (e.savedViewName?.value || '').trim();
  if (!name) return toast('Name this Saved View');
  try {
    const primary = PRIMARY_BY_PANEL[state.activePanel] || 'chat';
    upsertSavedView(captureCurrentView({
      name,
      scope: state.scope,
      primary,
      panel: state.activePanel,
      universeLod: state.universeLod,
      universeViewMode: state.universeViewMode,
      filters: {
        stonesQuery: e.stonesQuery?.value || '',
        universeSearch: e.universeSearch?.value || '',
        scopeSearch: e.scopeSearch?.value || '',
        activityFilter: e.activityFilter?.value || ''
      },
      disclosure: currentDisclosurePrefs(),
      scopeSnapshot: state.scopeSnapshot
    }));
    if (e.savedViewName) e.savedViewName.value = '';
    renderSavedViewsList();
    toast('Saved View stored locally (presentation only)');
  } catch (err) {
    toast(err.message || 'Could not save view');
  }
}

async function openSavedViewById(id) {
  const view = loadSavedViewsStore().views.find(v => v.id === id);
  if (!view) return toast('Saved View not found');
  toast('Opening Saved View… re-resolving Scope');
  const result = await openSavedView(view, {
    applyPresentation: applySavedViewPresentation,
    async resolveScope(selector) {
      // Fresh authority — never trust frozen HEADs from the Saved View payload.
      return setScope(selector, undefined, { recordRecent: true });
    },
    onFreshness: (f) => {
      showSavedViewFreshness(f);
      if (f?.headsMayHaveMoved) openSheet('scopeSheet');
    },
    onError: (err) => toast(err.message || 'Open failed')
  });
  if (result.ok) {
    closeSheet('savedViewsSheet');
    if (result.freshness?.headsMayHaveMoved) {
      toast('Scope heads may have moved — showing fresh resolve');
    } else {
      toast('Saved View opened · Scope re-resolved');
    }
    if (!e.universeOverlay.classList.contains('hidden')) renderUniverse().catch(() => {});
  }
}

async function copy(value) { await navigator.clipboard.writeText(value); toast('Copied'); }

document.querySelectorAll('.nav-item[data-nav]').forEach(t => t.addEventListener('click', () => navigatePrimary(t.dataset.nav)));
document.querySelectorAll('.subnav-item[data-panel]').forEach(t => t.addEventListener('click', () => panel(t.dataset.panel)));
e.providerSelect.addEventListener('change', renderModels);
e.healthButton.addEventListener('click', () => health().catch(() => {}));
if (e.contextRuntimeBtn) e.contextRuntimeBtn.addEventListener('click', () => openSheet('runtimeSheet'));
if (e.contextScopeBtn) e.contextScopeBtn.addEventListener('click', () => openSheet('scopeSheet'));
if (e.contextActorBtn) e.contextActorBtn.addEventListener('click', () => openSheet('runtimeSheet'));
if (e.contextChatBtn) e.contextChatBtn.addEventListener('click', () => panel('chat'));
if (e.contextCodeBtn) e.contextCodeBtn.addEventListener('click', () => panel('code'));
if (e.contextViewsBtn) e.contextViewsBtn.addEventListener('click', () => openSheet('savedViewsSheet'));
if (e.savedViewSave) e.savedViewSave.addEventListener('click', saveCurrentSavedView);
if (e.settingsOpenSheet) e.settingsOpenSheet.addEventListener('click', () => openSheet('runtimeSheet'));
if (e.runtimeSheetRecheck) e.runtimeSheetRecheck.addEventListener('click', () => health().catch(() => {}));
if (e.universeOpenScope) e.universeOpenScope.addEventListener('click', () => openSheet('scopeSheet'));
if (e.universeOpenRuntime) e.universeOpenRuntime.addEventListener('click', () => openSheet('runtimeSheet'));
if (e.openChatConfig) e.openChatConfig.addEventListener('click', () => openSheet('chatConfigSheet'));
if (e.openEvidenceDrawer) e.openEvidenceDrawer.addEventListener('click', openEvidenceDrawerForResult);
document.querySelectorAll('[data-close-sheet]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-close-sheet');
    if (id === MESSAGE_READER_SHEET_ID) return closeMessageReaderFocus();
    closeSheet(id);
  });
});
window.addEventListener('popstate', () => {
  if (e.messageReaderSheet && !e.messageReaderSheet.classList.contains('hidden')) {
    closeMessageReaderFocus({ fromPopstate: true });
  }
});
if (e.scopeAdvanced) {
  e.scopeAdvanced.addEventListener('toggle', () => { e.scopeAdvanced.dataset.userTouched = '1'; });
}
if (e.operatorToken) {
  e.operatorToken.addEventListener('change', () => syncAuthorizeDisclosure());
  e.operatorToken.addEventListener('input', () => syncAuthorizeDisclosure());
}
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
if (e.inboxActor) {
  e.inboxActor.addEventListener('change', () => {
    ingestCustomActorField(e.inboxActor.value, { into: 'inbox' });
    saveSettings();
    renderAllActorNavigators();
  });
}
if (e.activityActors) {
  e.activityActors.addEventListener('change', () => {
    ingestCustomActorField(e.activityActors.value, { into: 'activity' });
    syncActivityActorsFieldFromSelection();
    saveSettings();
    renderAllActorNavigators();
  });
}
if (e.handoffTo) {
  e.handoffTo.addEventListener('change', () => {
    ingestCustomActorField(e.handoffTo.value, { into: 'handoff' });
    // Preserve explicit custom list as source of truth when Advanced is edited
    const { ids } = parseLegacyActorField(e.handoffTo.value);
    state.actorNav.customHandoffIds = ids;
    const keys = ids.map(id => parseMailboxId(id)?.namespace?.toLowerCase()).filter(Boolean);
    const matched = keys.filter(k => state.actorNav.directory.some(a => a.key === k));
    if (matched.length) state.actorNav.handoffKeys = [...new Set(matched)];
    saveSettings();
    renderAllActorNavigators();
  });
}
e.stonesRefresh.addEventListener('click', refreshStones);
e.copyStoneHash.addEventListener('click', () => copy(state.selectedStone?.hash || state.selectedStone?.stone_hash || ''));
e.authorizationRefresh.addEventListener('click', refreshAuthorizations);
e.authorizationReject.addEventListener('click', () => decideAuthorization('deny'));
e.authorizationApprove.addEventListener('click', () => decideAuthorization('approve'));
e.operatorToken.addEventListener('input', () => {
  const v = e.operatorToken.value.trim();
  if (v) sessionStorage.setItem('cs.operatorToken', v); else sessionStorage.removeItem('cs.operatorToken');
});

document.querySelectorAll('[data-share-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.getAttribute('data-share-mode') || 'give-access';
    const source = btn.getAttribute('data-share-source') || 'message-reader';
    const object = shareObjectFromSource(source);
    openShareSheet({ mode, source, object });
  });
});
document.querySelectorAll('.share-mode-tab').forEach(btn => {
  btn.addEventListener('click', () => setShareModeUi(btn.getAttribute('data-share-tab') || 'give-access'));
});
if (e.shareHumanCommit) e.shareHumanCommit.addEventListener('change', refreshShareProposal);
if (e.sharePermission) e.sharePermission.addEventListener('change', refreshShareProposal);
if (e.shareNotify) e.shareNotify.addEventListener('change', refreshShareProposal);
if (e.shareAssignTask) e.shareAssignTask.addEventListener('input', refreshShareProposal);
if (e.shareForwardNote) e.shareForwardNote.addEventListener('input', refreshShareProposal);
if (e.shareForwardSubject) e.shareForwardSubject.addEventListener('input', refreshShareProposal);
if (e.sharePrincipal) {
  e.sharePrincipal.addEventListener('change', () => {
    state.share.customPrincipal = e.sharePrincipal.value.trim();
    ingestCustomActorField(e.sharePrincipal.value, { into: 'observed' });
    const parsed = parseMailboxId(e.sharePrincipal.value);
    if (parsed?.namespace) state.share.principalKey = parsed.namespace.toLowerCase();
    renderShareActorPicker();
    refreshShareProposal();
  });
  e.sharePrincipal.addEventListener('input', refreshShareProposal);
}
if (e.shareCommitButton) e.shareCommitButton.addEventListener('click', () => commitShareAction());
if (e.intentText) e.intentText.addEventListener('input', refreshIntentControls);
if (e.intentHumanCommit) e.intentHumanCommit.addEventListener('change', refreshIntentControls);
if (e.intentRouteButton) e.intentRouteButton.addEventListener('click', () => routeConsoleIntent());
if (e.intentCommitProposal) e.intentCommitProposal.addEventListener('click', () => commitConsoleProposal());
if (e.dispatchTaskRunId) e.dispatchTaskRunId.addEventListener('input', refreshIntentControls);
if (e.dispatchHumanCommit) e.dispatchHumanCommit.addEventListener('change', refreshIntentControls);
if (e.dispatchCommitButton) e.dispatchCommitButton.addEventListener('click', () => commitConsoleDispatch());
if (e.eventPollButton) e.eventPollButton.addEventListener('click', () => pollWorkerEvents());
if (e.eventTreeButton) e.eventTreeButton.addEventListener('click', () => pollWorkerAgentTree());
if (e.retentionPreviewButton) e.retentionPreviewButton.addEventListener('click', () => previewContextRetention());
if (e.accessGrantsRefresh) e.accessGrantsRefresh.addEventListener('click', () => refreshAccessGrants());
if (e.codeGiveAccess || $('codeGiveAccess')) {
  /* Work buttons use data-share-mode handlers above once enabled by code-session.js */
}

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
  if (e.messageReaderSheet && !e.messageReaderSheet.classList.contains('hidden')) return closeMessageReaderFocus();
  if (e.evidenceDrawer && !e.evidenceDrawer.classList.contains('hidden')) return closeSheet('evidenceDrawer');
  if (e.chatConfigSheet && !e.chatConfigSheet.classList.contains('hidden')) return closeSheet('chatConfigSheet');
  if (e.savedViewsSheet && !e.savedViewsSheet.classList.contains('hidden')) return closeSheet('savedViewsSheet');
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
syncSavedViewsContextLabel();
syncAuthorizeDisclosure();
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

let workGuideApi = null;
workGuideApi = initWorkGuidePanel({
  mcpCall,
  operatorCall,
  toast,
  busy,
  esc,
  actorId: () => (e.actorId?.value || '').trim(),
  panel,
  invitePrefill: (opts) => inviteApi?.prefillForCodeSession?.(opts) || inviteApi?.prefill?.(opts),
  mintWorkspaceInvite: (spec) => mintWorkspaceInviteAndNotify({
    operatorCall,
    mcpCall,
    actorId: () => (e.actorId?.value || 'console:jared').trim()
  }, spec)
});

refreshIntentControls();
setEventResult(subscribeHonesty());
applyReducedMotionClass();
await health().catch(() => {});
await loadVaultCatalog().catch(err => {
  e.scopeCatalog.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
});
await loadCapabilities();
syncContextBar();
panel(state.activePanel || 'chat');