import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initLiveNextWork, projectStartHere, LIVE_NEXT_WORK_TOOL, LIVE_NEXT_WORK_CHAIN } from './stone-todos-live.js';
import { formatStoneTodoPrompt } from './stone-todos.js';

const response = () => ({
  ok: true,
  start_here: {
    title: 'START HERE — Apply shared D1 migration 0025 and run Semantic Audit live acceptance',
    next: 'apply shared D1 migration 0025 safely, then run migration-backed live acceptance and record exact result',
    stone_hash: '8836c9baf4301f9b451eac9b41deba10ab41b137aef3c9320da26d62a7f14939',
    path: 'project-memory/handoffs/2026-10-04-v7710f1a-apply-migration-0025-live-acceptance.md',
    metadata: { status: 'ready-for-execution' }
  }
});

class Node {
  constructor(tag, doc) {
    this.tagName = tag;
    this.ownerDocument = doc;
    this.childNodes = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
  }
  append(...nodes) { this.childNodes.push(...nodes); }
  replaceChildren(...nodes) { this.childNodes = nodes; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
}
const descendants = node => [node, ...node.childNodes.flatMap(descendants)];
function harness({ read = async () => response(), identity = 'core-user', clipboard = {} } = {}) {
  const doc = { createElement: tag => new Node(tag, doc) };
  const root = new Node('div', doc);
  const status = new Node('p', doc);
  const refreshButton = new Node('button', doc);
  let currentIdentity = identity;
  const calls = [];
  const api = initLiveNextWork({
    root, status, refreshButton, clipboard,
    sessionKey: () => currentIdentity,
    read: async (...args) => { calls.push(args); return read(...args); }
  });
  return { root, status, refreshButton, api, calls, setIdentity: key => { currentIdentity = key; } };
}

test('projects exact start_here fields, actual status, and non-authoritative Grok prompt', () => {
  const source = response().start_here;
  const card = projectStartHere(response());
  assert.equal(card.title, source.title);
  assert.equal(card.source_stone_hash, source.stone_hash);
  assert.equal(card.source_path, source.path);
  assert.equal(card.status, source.metadata.status);
  const prompt = formatStoneTodoPrompt(card);
  for (const value of [source.title, source.next, source.path, source.stone_hash, source.metadata.status]) assert.ok(prompt.includes(value));
  assert.match(prompt, /Destination actor: grok:cairnstone-v6/);
  assert.match(prompt, /board grants no authority/);
  assert.match(prompt, /Do not apply migration 0025/);
  assert.doesNotMatch(prompt, /SAMPLE ONLY/);
});

test('missing, malformed, and failed start_here never produce sample/HEAD fallback', () => {
  for (const value of [null, { ok: false, error: 'denied' }, { canonical_head: response().start_here }]) assert.throws(() => projectStartHere(value));
  for (const key of ['title', 'next', 'stone_hash', 'path']) {
    const value = response(); delete value.start_here[key];
    assert.throws(() => projectStartHere(value), /missing/);
  }
  const value = response(); value.start_here.stone_hash = 'bad';
  assert.throws(() => projectStartHere(value), /invalid/);
  value.start_here.stone_hash = response().start_here.stone_hash;
  delete value.start_here.metadata.status;
  assert.throws(() => projectStartHere(value), /missing status/);
});

test('signed out: visible error, zero MCP calls, no live cards', async () => {
  const h = harness({ identity: null });
  await h.api.refresh();
  assert.equal(h.calls.length, 0);
  assert.equal(h.root.childNodes.length, 0);
  assert.equal(h.root.dataset.state, 'signed-out');
  assert.match(h.status.textContent, /Core sign-in required/);
});

test('live refresh performs exactly the existing read, copy matches manual preview, no sends', async () => {
  let copied;
  const h = harness({ clipboard: { writeText: async text => { copied = text; } } });
  await h.api.refresh();
  assert.deepEqual(h.calls, [[LIVE_NEXT_WORK_TOOL, { chain: LIVE_NEXT_WORK_CHAIN, detail: 'start_here' }]]);
  assert.equal(h.root.childNodes.length, 1);
  assert.equal(h.root.dataset.state, 'live');
  const nodes = descendants(h.root);
  assert.ok(nodes.some(n => n.textContent === response().start_here.path));
  await nodes.find(n => n.tagName === 'button').listeners.click();
  assert.equal(copied, nodes.find(n => n.tagName === 'textarea').value);
  assert.equal(h.calls.length, 1);
  assert.match(nodes.find(n => n.attributes.role === 'status').textContent, /Nothing was sent/);
});

test('live clipboard failure opens/selects manual preview and never invokes MCP', async () => {
  const h = harness();
  await h.api.refresh();
  const nodes = descendants(h.root);
  await nodes.find(n => n.tagName === 'button').listeners.click();
  assert.equal(nodes.find(n => n.tagName === 'details').open, true);
  assert.equal(nodes.find(n => n.tagName === 'textarea').selected, true);
  assert.equal(h.calls.length, 1);
});

test('read errors and malformed responses clear prior Live without fallback', async () => {
  let value = response();
  const h = harness({ read: async () => { if (value instanceof Error) throw value; return value; } });
  await h.api.refresh();
  for (const failure of [new Error('MCP HTTP 401'), { ok: false, error: 'denied' }, { start_here: {} }]) {
    value = failure;
    await h.api.refresh();
    assert.equal(h.root.dataset.state, 'error');
    assert.equal(h.root.childNodes.length, 0);
    assert.match(h.status.textContent, /Live unavailable/);
    assert.match(h.status.textContent, /remain samples/);
  }
});

test('refresh races, sign-out, and runtime/account changes cannot restore stale cards', async () => {
  const pending = [];
  const h = harness({ read: () => new Promise(resolve => pending.push(resolve)) });
  const first = h.api.refresh();
  const second = h.api.refresh();
  pending[1](response()); await second;
  const title = 'NEWEST SOURCE';
  const newer = response(); newer.start_here.title = title;
  pending[0](newer); await first;
  assert.ok(!descendants(h.root).some(n => n.textContent?.includes(title)));
  const third = h.api.refresh();
  h.setIdentity(null); h.api.clear();
  pending[2](response()); await third;
  assert.equal(h.root.dataset.state, 'signed-out');
  assert.equal(h.root.childNodes.length, 0);
  h.setIdentity('different-account');
  const fourth = h.api.refresh();
  h.setIdentity('changed-runtime'); h.api.clear();
  pending[3](response()); await fourth;
  assert.equal(h.root.dataset.state, 'idle');
  assert.equal(h.root.childNodes.length, 0);
});

test('source is text-only; Live is before SAMPLE; wiring gates Core and has no write tools', async () => {
  const data = response(); data.start_here.title = '<img onerror=alert(1)>';
  const h = harness({ read: async () => data });
  await h.api.refresh();
  assert.ok(descendants(h.root).some(n => n.textContent?.includes('<img onerror=alert(1)>')));
  assert.ok(!descendants(h.root).some(n => n.tagName === 'img'));
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  const module = readFileSync(new URL('./stone-todos-live.js', import.meta.url), 'utf8');
  assert.ok(html.indexOf('id="nextWorkLiveBoard"') < html.indexOf('<h3>SAMPLE ONLY</h3>'));
  assert.match(app, /if \(panelName === 'next-work'\) void nextWorkLive\?\.refresh\(\)/);
  assert.match(app, /!session\?\.access_token.*!session\?\.refresh_token.*!isCoreAuthMcpUrl/);
  assert.doesNotMatch(module, /\b(?:fetch|XMLHttpRequest|WebSocket|operatorCall|commit_v2|set_head|set_path_head|send_message)\s*\(/);
  assert.match(module, /read\(LIVE_NEXT_WORK_TOOL, \{ chain: LIVE_NEXT_WORK_CHAIN, detail: 'start_here' \}\)/);
});
