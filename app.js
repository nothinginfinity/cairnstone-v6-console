const DEFAULT_RUNTIME = 'https://cairnstone-v6.jaredtechfit.workers.dev/mcp';
const DEFAULT_CHAIN = 'cairnstone-v6-project-memory';
const MAX_SCOPE_CATALOG_CHAINS = 500;
const MAX_SCOPE_QA_CHAINS = 25;
const $ = id => document.getElementById(id);

const state = {
  capabilities: [],
  lastResult: null,
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
  universeLod: 'repos',
  universeMultiMode: false,
  universeMultiSelection: new Set()
};

const e = {
  runtimeUrl: $('runtimeUrl'), actorId: $('actorId'), healthButton: $('healthButton'), healthDot: $('healthDot'), healthText: $('healthText'),
  scopeSummary: $('scopeSummary'), scopeAuthority: $('scopeAuthority'), scopeCoverage: $('scopeCoverage'), scopeSearch: $('scopeSearch'), scopeAll: $('scopeAll'), scopeDefault: $('scopeDefault'),
  scopeRecentsWrap: $('scopeRecentsWrap'), scopeRecents: $('scopeRecents'), scopeCatalog: $('scopeCatalog'), scopePicker: $('scopePicker'),
  universeButton: $('universeButton'), universeOverlay: $('universeOverlay'), universeClose: $('universeClose'), universeSearch: $('universeSearch'), universeLod: $('universeLod'),
  universeMulti: $('universeMulti'), universeApply: $('universeApply'), universeCanvas: $('universeCanvas'), universeFallbackList: $('universeFallbackList'),
  providerSelect: $('providerSelect'), modelSelect: $('modelSelect'), credentialAliasWrap: $('credentialAliasWrap'), credentialAlias: $('credentialAlias'),
  singleChainRouteControls: $('singleChainRouteControls'), temperatureWrap: $('temperatureWrap'), includeInboxWrap: $('includeInboxWrap'), chatModeNote: $('chatModeNote'),
  taskInput: $('taskInput'), outputTokens: $('outputTokens'), temperature: $('temperature'), includeInbox: $('includeInbox'), delegateButton: $('delegateButton'), refreshModels: $('refreshModels'),
  resultTitle: $('resultTitle'), resultMeta: $('resultMeta'), resultText: $('resultText'), copyResult: $('copyResult'),
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

function loadSettings() {
  e.runtimeUrl.value = localStorage.getItem('cs.runtime') || DEFAULT_RUNTIME;
  e.actorId.value = localStorage.getItem('cs.actor') || 'console:jared';
  e.inboxActor.value = localStorage.getItem('cs.inboxActor') || e.actorId.value;
  e.activityActors.value = localStorage.getItem('cs.activityActors') || e.actorId.value;
  e.operatorToken.value = sessionStorage.getItem('cs.operatorToken') || '';

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
}

function saveSettings() {
  localStorage.setItem('cs.runtime', e.runtimeUrl.value.trim());
  localStorage.setItem('cs.actor', e.actorId.value.trim());
  localStorage.setItem('cs.inboxActor', e.inboxActor.value.trim());
  localStorage.setItem('cs.activityActors', e.activityActors.value.trim());
  localStorage.setItem('cs.scope.v1', JSON.stringify(normalizeScope(state.scope)));
  if (state.scope.mode === 'single_chain' && state.scope.chains?.[0]) localStorage.setItem('cs.chain', state.scope.chains[0]);
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
  if (!e.universeOverlay.classList.contains('hidden')) renderUniverse();
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
    return snap;
  } catch (err) {
    state.scopeSnapshot = null;
    e.scopeSummary.textContent = 'Scope unavailable';
    e.scopeAuthority.textContent = err.message;
    e.scopeCoverage.textContent = '';
    updateScopeDependents();
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
  const single = state.scope.mode === 'single_chain' && (state.scopeSnapshot?.chains?.length || 0) === 1;
  e.singleChainRouteControls.classList.toggle('hidden', !single);
  e.temperatureWrap.classList.toggle('hidden', !single);
  e.includeInboxWrap.classList.toggle('hidden', !single);
  e.refreshModels.classList.toggle('hidden', !single);
  if (single) {
    const chain = state.scopeSnapshot?.chains?.[0]?.chain || state.scope.chains?.[0] || DEFAULT_CHAIN;
    e.chatModeNote.textContent = `Single-chain Scope · provider-neutral cairnstone_delegate grounded in ${chain}.`;
  } else {
    const n = state.scopeSnapshot?.chains?.length || 0;
    e.chatModeNote.textContent = `Multi-chain Scope · citation-validated cairnstone_ask_scope across the exact ${n}-chain authority snapshot. No model tool execution and no persistent answer stone.`;
  }
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
    busy(e.refreshModels, false, 'Models');
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

  busy(e.delegateButton, true, 'Asking…');
  e.resultTitle.textContent = 'Working…';
  e.resultText.textContent = 'Resolving accepted authority and grounded evidence.';
  try {
    let r;
    if (state.scope.mode === 'single_chain' && state.scopeSnapshot.chains?.length === 1) {
      r = await mcpCall('cairnstone_delegate', {
        actor_id: e.actorId.value.trim(),
        task,
        chain: state.scopeSnapshot.chains[0].chain,
        route: route(),
        generation: { max_output_tokens: Number(e.outputTokens.value || 800), temperature: Number(e.temperature.value || 0.2) },
        include_inbox: e.includeInbox.checked
      });
      e.handoffPackage.value = r.package_id || '';
      e.continuationHash.value = r.evidence?.chain_head?.hash || r.evidence?.chain_head?.stone_hash || '';
    } else {
      const chains = state.scopeSnapshot.chains || [];
      if (chains.length > MAX_SCOPE_QA_CHAINS) throw new Error(`Current Scope resolves to ${chains.length} chains; cairnstone_ask_scope accepts at most ${MAX_SCOPE_QA_CHAINS}. Narrow Scope first.`);
      const headless = chains.find(x => !x.head_hash);
      if (headless) throw new Error(`Current Scope includes ${headless.chain}, which has no canonical HEAD. Narrow Scope before grounded synthesis.`);
      r = await mcpCall('cairnstone_ask_scope', {
        question: task,
        scope: scopeArgs(),
        max_tokens: Number(e.outputTokens.value || 800)
      });
      e.handoffPackage.value = '';
      e.continuationHash.value = '';
    }
    state.lastResult = r;
    renderResult(r);
    renderEvidence(r);
    toast('Grounded answer complete');
  } catch (err) {
    const p = err.payload || {};
    state.lastResult = p?.ok === false ? p : null;
    e.resultTitle.textContent = p.error || 'Request failed';
    e.resultMeta.innerHTML = '';
    e.resultText.textContent = p.detail || p.hint || err.message;
    renderEvidence(p);
    toast(err.message);
  } finally {
    busy(e.delegateButton, false, 'Ask current Scope');
  }
}

function renderResult(r) {
  if (r?.schema === 'cairnstone-scope-answer-v1') {
    e.resultTitle.textContent = `Scope Q&A · ${r.model || 'Workers AI'}`;
    e.resultText.textContent = r.answer || '(No answer returned)';
    e.resultMeta.innerHTML = [
      ['scope', short(r.scope_snapshot?.scope_id)],
      ['chains', String(r.scope_snapshot?.chains?.length || 0)],
      ['cited', String(r.cited_stones?.length || 0)],
      ['citations', r.citation_validation?.ok === true ? 'validated' : 'unknown'],
      ['coverage', r.coverage?.complete === true ? 'complete' : 'bounded']
    ].map(([k, v]) => chip(`${k}: ${v}`)).join('');
  } else {
    e.resultTitle.textContent = `${r.route?.provider || 'model'} · ${r.route?.model || 'unknown'}`;
    e.resultText.textContent = r.output?.text || '(No text returned)';
    e.resultMeta.innerHTML = [
      ['package', short(r.package_id)],
      ['request', short(r.request_ir_id)],
      ['input', tok(r.usage?.input_tokens)],
      ['output', tok(r.usage?.output_tokens)],
      ['tools', String(r.policy?.tools_executed ?? 0)]
    ].map(([k, v]) => chip(`${k}: ${v}`)).join('');
  }
  e.copyResult.disabled = false;
}

function renderEvidence(r) {
  const snap = r?.scope_snapshot || state.scopeSnapshot;
  if (r?.schema === 'cairnstone-scope-answer-v1') {
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
  try {
    const r = await mcpCall('cairnstone_get_inbox', { recipient_id: recipient, limit: 100 });
    state.inbox = r.messages || [];
    renderInbox();
    toast(`${state.inbox.length} messages`);
  } catch (err) {
    e.inboxList.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    toast(err.message);
  } finally {
    busy(e.refreshInbox, false, 'Refresh');
  }
}

function renderInbox() {
  if (!state.inbox.length) {
    e.inboxList.innerHTML = '<p class="muted">No messages.</p>';
    return;
  }
  e.inboxList.innerHTML = '';
  state.inbox.forEach(m => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'message-item';
    b.innerHTML = `<strong>${esc(m.subject || '(no subject)')}</strong><div class="meta">${esc(m.sender_id || 'unknown')} · ${esc(m.status || '')} · ${esc(m.priority || 'normal')}</div><div class="meta">${esc(short(m.stone_hash))}</div>`;
    b.addEventListener('click', () => readMessage(m));
    e.inboxList.append(b);
  });
}

async function readMessage(m) {
  e.messageTitle.textContent = 'Loading…';
  try {
    const r = await mcpCall('cairnstone_read_message', { recipient_id: e.inboxActor.value.trim(), message_id: m.message_id });
    e.messageTitle.textContent = r.metadata?.subject || m.subject || 'Message';
    e.messageMeta.innerHTML = [['from', r.metadata?.from || m.sender_id], ['intent', r.metadata?.intent || m.intent], ['thread', r.thread_id], ['stone', short(r.stone_hash)], ['scope', r.mutation_scope]].map(([k, v]) => chip(`${k}: ${v || '—'}`)).join('');
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
  if (!(state.scopeSnapshot?.chains || []).some(x => x.chain === chain)) return toast('Handoff chain must be an exact participating chain in the current Scope');

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
    e.activityList.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    toast(err.message);
  } finally {
    busy(e.activityRefresh, false, 'Refresh');
  }
}

function renderActivity() {
  let items = (state.activity || []).slice();
  const filter = e.activityFilter.value;
  if (filter === 'handoff') items = items.filter(m => m.intent === 'handoff');
  else if (filter === 'message') items = items.filter(m => m.intent !== 'handoff');
  items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  if (!items.length) {
    e.activityList.innerHTML = '<p class="muted">No activity matches.</p>';
    return;
  }
  e.activityList.innerHTML = '';
  if (e.activityGroupThreads.checked) {
    const groups = new Map();
    items.forEach(m => {
      const key = m.thread_id || '(no thread)';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    });
    for (const [thread, messages] of groups) {
      const h = document.createElement('div');
      h.className = 'list-item';
      h.innerHTML = `<strong>${esc(thread)}</strong><div class="meta">${messages.length} message${messages.length === 1 ? '' : 's'}</div>`;
      e.activityList.append(h);
      messages.forEach(m => e.activityList.append(activityItemEl(m)));
    }
  } else {
    items.forEach(m => e.activityList.append(activityItemEl(m)));
  }
}

function activityItemEl(m) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'message-item';
  const unread = m.status !== 'read';
  b.innerHTML = `<strong>${unread ? '● ' : ''}${esc(m.subject || '(no subject)')}</strong><div class="meta">to ${esc(m.for || '')} · from ${esc(m.sender_id || 'unknown')} · ${esc(m.intent || 'message')} · ${esc(m.priority || 'normal')} · ${esc(m.status || '')}</div><div class="meta">${esc(short(m.stone_hash))}</div>`;
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
  e.universeOverlay.classList.remove('hidden');
  e.universeSearch.value = '';
  renderUniverse();
  e.universeSearch.focus();
}

function closeUniverse() {
  e.universeOverlay.classList.add('hidden');
}

function renderUniverse() {
  e.universeOverlay.classList.toggle('universe-multi-on', state.universeMultiMode);
  e.universeLod.textContent = `LOD: ${state.universeLod === 'repos' ? 'Repos' : 'Chains'}`;
  e.universeApply.disabled = !state.universeMultiMode || !state.universeMultiSelection.size;
  renderUniverseCanvas();
  renderUniverseFallback();
}

function selectorActive(type, value) {
  if (type === 'vault') return state.scope.mode === 'vault';
  if (type === 'repo') return state.scope.mode === 'repo' && (state.scope.repos || []).includes(value);
  return (state.scope.mode === 'single_chain' || state.scope.mode === 'multi') && (state.scope.chains || []).includes(value);
}

function renderUniverseCanvas() {
  const groups = primaryRepoGroups();
  const nodes = [];
  nodes.push({ type: 'vault', value: 'All CairnStone', label: 'All CairnStone', x: 50, y: 50 });

  const repoRadiusX = 35;
  const repoRadiusY = 34;
  groups.forEach(([repo, chains], repoIndex) => {
    const angle = (Math.PI * 2 * repoIndex / Math.max(1, groups.length)) - Math.PI / 2;
    const rx = 50 + Math.cos(angle) * repoRadiusX;
    const ry = 50 + Math.sin(angle) * repoRadiusY;
    nodes.push({ type: 'repo', value: repo, label: repo, x: rx, y: ry });
    chains.forEach((row, chainIndex) => {
      const cAngle = angle + ((chainIndex - (chains.length - 1) / 2) * 0.18);
      const orbit = 8 + Math.min(6, chainIndex * 1.2);
      const x = clamp(rx + Math.cos(cAngle + Math.PI / 2) * orbit, 5, 95);
      const y = clamp(ry + Math.sin(cAngle + Math.PI / 2) * orbit, 5, 95);
      nodes.push({ type: 'chain', value: row.chain, label: row.chain, x, y, headless: !row.canonical_head });
    });
  });

  e.universeCanvas.classList.toggle('lod-repos', state.universeLod === 'repos');
  e.universeCanvas.innerHTML = nodes.map(n => {
    const active = selectorActive(n.type, n.value);
    const multi = n.type === 'chain' && state.universeMultiSelection.has(n.value);
    return `<button class="universe-node ${n.type} ${active ? 'active' : ''} ${multi ? 'multi-selected' : ''}" type="button" data-utype="${n.type}" data-uvalue="${esc(n.value)}" data-label="${esc(n.label.toLowerCase())}" style="left:${n.x}%;top:${n.y}%">${esc(n.label)}${n.headless ? ' · no HEAD' : ''}</button>`;
  }).join('');

  e.universeCanvas.querySelectorAll('[data-utype]').forEach(b => b.addEventListener('click', () => universeNodeAction(b.dataset.utype, b.dataset.uvalue)));
  focusUniverse();
}

function renderUniverseFallback() {
  const groups = repoGroups(e.universeSearch.value);
  const selected = state.universeMultiSelection;
  e.universeFallbackList.innerHTML = `<button class="repo-row ${selectorActive('vault', 'All CairnStone') ? 'active' : ''}" type="button" data-fallback-vault="1"><strong>All CairnStone</strong><span>›</span></button>` +
    groups.map(([repo, chains]) => `<div class="repo-group">
      <button class="repo-row ${selectorActive('repo', repo) ? 'active' : ''}" type="button" data-fallback-repo="${repo === '(no repository provenance)' ? '' : esc(repo)}" ${repo === '(no repository provenance)' ? 'disabled' : ''}><span><strong>${esc(repo)}</strong><div class="meta">${chains.length} chains</div></span><span>›</span></button>
      <div class="chain-list">${chains.map(row => `<button class="chain-row ${selectorActive('chain', row.chain) ? 'active' : ''}" type="button" data-fallback-chain="${esc(row.chain)}"><input tabindex="-1" type="checkbox" ${selected.has(row.chain) ? 'checked' : ''} aria-hidden="true"><span>${esc(row.chain)}${row.canonical_head ? '' : ' · no HEAD'}</span></button>`).join('')}</div>
    </div>`).join('');
  e.universeFallbackList.querySelector('[data-fallback-vault]')?.addEventListener('click', () => universeNodeAction('vault', 'All CairnStone'));
  e.universeFallbackList.querySelectorAll('[data-fallback-repo]').forEach(b => { if (b.dataset.fallbackRepo) b.addEventListener('click', () => universeNodeAction('repo', b.dataset.fallbackRepo)); });
  e.universeFallbackList.querySelectorAll('[data-fallback-chain]').forEach(b => b.addEventListener('click', () => universeNodeAction('chain', b.dataset.fallbackChain)));
}

async function universeNodeAction(type, value) {
  if (type === 'chain' && state.universeMultiMode) {
    if (state.universeMultiSelection.has(value)) state.universeMultiSelection.delete(value); else state.universeMultiSelection.add(value);
    renderUniverse();
    return;
  }
  if (type === 'vault') await setScope({ mode: 'vault', max_chains: 200 }, 'All CairnStone');
  else if (type === 'repo') await setScope({ mode: 'repo', repos: [value], max_chains: 200 }, `Repo · ${value}`);
  else await setScope({ mode: 'single_chain', chains: [value], max_chains: 200 }, value);
}

function focusUniverse() {
  const q = e.universeSearch.value.trim().toLowerCase();
  e.universeCanvas.querySelectorAll('.universe-node').forEach(node => {
    const match = !q || node.dataset.label.includes(q);
    node.classList.toggle('dim', Boolean(q) && !match);
    node.classList.toggle('focused', Boolean(q) && match);
  });
}

async function applyUniverseMulti() {
  const chains = [...state.universeMultiSelection].sort();
  if (!chains.length) return toast('Select at least one chain');
  if (chains.length === 1) await setScope({ mode: 'single_chain', chains, max_chains: 200 }, chains[0]);
  else await setScope({ mode: 'multi', chains, max_chains: 200 }, `${chains.length} chains`);
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
async function copy(value) { await navigator.clipboard.writeText(value); toast('Copied'); }
function panel(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.panel === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
}

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => panel(t.dataset.panel)));
e.providerSelect.addEventListener('change', renderModels);
e.healthButton.addEventListener('click', () => health().catch(() => {}));
e.refreshModels.addEventListener('click', loadCapabilities);
e.delegateButton.addEventListener('click', askCurrentScope);
e.refreshInbox.addEventListener('click', refreshInbox);
e.handoffButton.addEventListener('click', handoff);
e.copyResult.addEventListener('click', () => copy(state.lastResult?.answer || state.lastResult?.output?.text || ''));
e.copyEvidence.addEventListener('click', () => copy(JSON.stringify({ scope_snapshot: state.scopeSnapshot, result: state.lastResult }, null, 2)));
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
e.universeSearch.addEventListener('input', () => { focusUniverse(); renderUniverseFallback(); });
e.universeLod.addEventListener('click', () => { state.universeLod = state.universeLod === 'repos' ? 'chains' : 'repos'; renderUniverse(); });
e.universeMulti.addEventListener('click', () => {
  state.universeMultiMode = !state.universeMultiMode;
  if (state.universeMultiMode && !state.universeMultiSelection.size && (state.scopeSnapshot?.chains?.length || 0) <= 12) {
    state.universeMultiSelection = new Set(state.scopeSnapshot.chains.map(x => x.chain));
  }
  renderUniverse();
});
e.universeApply.addEventListener('click', applyUniverseMulti);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !e.universeOverlay.classList.contains('hidden')) closeUniverse(); });

[e.runtimeUrl, e.actorId, e.inboxActor, e.activityActors].forEach(x => x.addEventListener('change', saveSettings));

loadSettings();
await health().catch(() => {});
await loadVaultCatalog().catch(err => {
  e.scopeCatalog.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
});
await loadCapabilities();
