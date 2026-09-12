import { initInvitePanel } from './invite.js';

const DEFAULT_RUNTIME = 'https://cairnstone-v6.jaredtechfit.workers.dev/mcp';
const $ = id => document.getElementById(id);

const e = {
  runtimeUrl: $('runtimeUrl'),
  actorId: $('actorId'),
  healthButton: $('healthButton'),
  healthDot: $('healthDot'),
  healthText: $('healthText'),
  operatorToken: $('operatorToken'),
  toast: $('toast')
};

function loadSettings() {
  if (e.runtimeUrl) e.runtimeUrl.value = localStorage.getItem('cs.runtime') || DEFAULT_RUNTIME;
  if (e.actorId) e.actorId.value = localStorage.getItem('cs.actor') || 'console:jared';
  if (e.operatorToken) e.operatorToken.value = sessionStorage.getItem('cs.operatorToken') || '';
}

function saveSettings() {
  if (e.runtimeUrl) localStorage.setItem('cs.runtime', e.runtimeUrl.value.trim());
  if (e.actorId) localStorage.setItem('cs.actor', e.actorId.value.trim());
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
  const token = e.operatorToken?.value?.trim();
  if (!token) throw new Error('Enter the operator token first (Authorize tab)');
  sessionStorage.setItem('cs.operatorToken', token);
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(`${runtimeBase()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let out;
  try { out = await r.json(); } catch { throw new Error(`Operator HTTP ${r.status}`); }
  if (!r.ok || out?.ok === false) {
    const err = new Error(out?.error || `Operator HTTP ${r.status}`);
    err.payload = out;
    throw err;
  }
  return out;
}

function setHealth(status, text) {
  if (e.healthDot) e.healthDot.className = `dot ${status === 'ok' ? 'ok' : status === 'bad' ? 'bad' : ''}`;
  if (e.healthText) e.healthText.textContent = text || 'Checking...';
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

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#039;' }[c]));
}
function chip(s) { return `<span class="chip" title="${esc(s)}">${esc(s)}</span>`; }
function busy(button, on, label) {
  if (!button) return;
  button.disabled = on;
  button.textContent = label;
}
let toastTimer;
function toast(message) {
  if (!e.toast) return;
  clearTimeout(toastTimer);
  e.toast.textContent = message;
  e.toast.classList.add('show');
  toastTimer = setTimeout(() => e.toast.classList.remove('show'), 2400);
}
function panel(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.panel === name));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
}

loadSettings();
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => panel(t.dataset.panel)));
e.healthButton?.addEventListener('click', () => health().catch(() => {}));
e.operatorToken?.addEventListener('input', () => {
  const v = e.operatorToken.value.trim();
  if (v) sessionStorage.setItem('cs.operatorToken', v);
  else sessionStorage.removeItem('cs.operatorToken');
});
[e.runtimeUrl, e.actorId].forEach(x => x?.addEventListener('change', saveSettings));

initInvitePanel({
  mcpCall,
  operatorCall,
  toast,
  busy,
  esc,
  chip,
  actorId: () => (e.actorId?.value || 'console:jared').trim()
});

await health().catch(() => {});
