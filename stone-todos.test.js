import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STONE_TODOS_FIXTURE } from './stone-todos-fixture.js';
import { NEXT_WORK_DESTINATIONS, formatStoneTodoPrompt, createFixtureTodoReader, copyStoneTodoPrompt, initStoneTodos } from './stone-todos.js';

// Small DOM contract double: exercise rendering and the actual registered click handler.
class Node {
  constructor(tag, doc) {
    this.tagName = tag;
    this.ownerDocument = doc;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
}
function rootNode() {
  const doc = { createElement: tag => new Node(tag, doc) };
  return new Node('div', doc);
}
function descendants(node) {
  return [node, ...node.children.flatMap(descendants)];
}
const fixture = STONE_TODOS_FIXTURE[0];

test('formatter includes exact fields and distinguishes samples from accepted authority', () => {
  const prompt = formatStoneTodoPrompt(fixture);
  for (const key of ['todo_id', 'title', 'why_next', 'destination_actor', 'asked_outcome', 'source_stone_hash', 'source_path', 'status']) {
    assert.ok(prompt.includes(fixture[key]), key);
  }
  assert.match(prompt, /SAMPLE ONLY/);
  assert.match(prompt, /Do not send AC1/);
  assert.match(formatStoneTodoPrompt({ ...fixture, sample: false }), /grants no authority/);
  assert.equal(prompt, formatStoneTodoPrompt(fixture));
});

test('all five specified actors have paste notes; unknown destinations are rejected', () => {
  assert.deepEqual(Object.keys(NEXT_WORK_DESTINATIONS), [
    'grok:cairnstone-v6', 'chatgpt:cairnstone-v6', 'claude:cairnstone-v6', 'grok-bot:cairnstone-v6', 'replit:cairnstone-v6'
  ]);
  for (const destination_actor of Object.keys(NEXT_WORK_DESTINATIONS)) {
    assert.match(formatStoneTodoPrompt({ ...fixture, destination_actor }), new RegExp(destination_actor));
    assert.match(NEXT_WORK_DESTINATIONS[destination_actor], /^Paste into the live /);
  }
  assert.throws(() => formatStoneTodoPrompt({ ...fixture, destination_actor: 'unknown' }), /Unsupported/);
  assert.throws(() => formatStoneTodoPrompt({ ...fixture, source_stone_hash: 'bad' }), /Invalid/);
  assert.throws(() => formatStoneTodoPrompt({ ...fixture, asked_outcome: '' }), /Missing/);
});

test('fixture reader is read-only, ordered, and returns detached rows', async () => {
  const reader = createFixtureTodoReader([...STONE_TODOS_FIXTURE].reverse());
  assert.deepEqual(Object.keys(reader), ['list']);
  const rows = await reader.list();
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(r => r.sequence), [1, 2, 3]);
  rows[0].status = 'done';
  assert.equal((await reader.list())[0].status, 'ready');
});

test('copy writes exactly the generated prompt; unavailable and denied clipboards reject', async () => {
  let copied;
  await copyStoneTodoPrompt(fixture, { writeText: async text => { copied = text; } });
  assert.equal(copied, formatStoneTodoPrompt(fixture));
  await assert.rejects(copyStoneTodoPrompt(fixture, {}), /Clipboard unavailable/);
  await assert.rejects(copyStoneTodoPrompt(fixture, { writeText: async () => { throw new Error('denied'); } }), /denied/);
});

test('view renders three cards and copying invokes only the clipboard, never any write tool', async () => {
  const root = rootNode();
  let copied;
  let writes = 0;
  await initStoneTodos({
    root,
    clipboard: { writeText: async text => { copied = text; } },
    // Unrecognized capabilities must not be consumed by the view.
    mcpCall: () => { writes++; throw new Error('Forbidden tool call'); },
    sendMessage: () => { writes++; }
  });
  assert.equal(root.children.length, 3);
  for (let index = 0; index < 3; index++) {
    const nodes = descendants(root.children[index]);
    assert.ok(nodes.some(n => n.textContent === STONE_TODOS_FIXTURE[index].source_stone_hash));
    assert.ok(nodes.some(n => n.textContent === STONE_TODOS_FIXTURE[index].source_path));
    const button = nodes.find(n => n.tagName === 'button');
    await button.listeners.click();
    assert.equal(copied, formatStoneTodoPrompt(STONE_TODOS_FIXTURE[index]));
    assert.match(nodes.find(n => n.attributes.role === 'status').textContent, /Nothing was sent/);
    assert.equal(button.disabled, false);
  }
  assert.equal(writes, 0);
  // Guard the complete new module/import graph against adding network/tool execution.
  const module = readFileSync(new URL('./stone-todos.js', import.meta.url), 'utf8');
  const fixtureSource = readFileSync(new URL('./stone-todos-fixture.js', import.meta.url), 'utf8');
  assert.doesNotMatch(module + fixtureSource, /\b(?:fetch|XMLHttpRequest|WebSocket|mcpCall|operatorCall|send_message|commit_v2|set_head|set_path_head)\s*\(/);
  assert.deepEqual([...module.matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1]), ['./stone-todos-fixture.js']);
  const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  assert.match(app, /void initStoneTodos\(\)/);
});

test('clipboard failure opens and selects manual preview without changing status', async () => {
  const root = rootNode();
  await initStoneTodos({ root, clipboard: {} });
  const nodes = descendants(root.children[0]);
  await nodes.find(n => n.tagName === 'button').listeners.click();
  assert.equal(nodes.find(n => n.tagName === 'details').open, true);
  assert.equal(nodes.find(n => n.tagName === 'textarea').selected, true);
  assert.match(nodes.find(n => n.attributes.role === 'status').textContent, /Copy failed/);
  assert.equal(STONE_TODOS_FIXTURE[0].status, 'ready');
});

test('empty, reader error, malformed card, and text injection remain honest', async () => {
  const root = rootNode();
  await initStoneTodos({ root, reader: { list: async () => [] } });
  assert.match(root.children[0].textContent, /No next work/);
  await initStoneTodos({ root, reader: { list: async () => { throw new Error('offline'); } } });
  assert.match(root.children[0].textContent, /unavailable: offline/);
  await initStoneTodos({ root, reader: { list: async () => [{ ...fixture, status: 'invalid' }] } });
  assert.match(root.children[0].textContent, /Invalid card status/);
  await initStoneTodos({ root, reader: createFixtureTodoReader([{ ...fixture, title: '<img onerror=alert(1)>' }]) });
  assert.ok(descendants(root).some(n => n.textContent === '1. <img onerror=alert(1)>'));
  assert.ok(!descendants(root).some(n => n.tagName === 'img'));
});

test('Next Work is reachable through Work subnav with phone-safe styles', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(html, /id="workSubnav"/);
  assert.match(html, /data-panel="next-work"/);
  assert.match(html, /id="panel-next-work"/);
  assert.match(app, /'next-work': 'work'/);
  assert.match(app, /#workSubnav \.subnav-item/);
  assert.match(css, /stone-todo-copy\{[^}]*min-height:48px/);
  assert.match(css, /stone-todo-source dd\{[^}]*overflow-wrap:anywhere/);
});

test('standalone page renders the same read-only board without console/runtime bootstrap', () => {
  const html = readFileSync(new URL('./next-work.html', import.meta.url), 'utf8');
  const entry = readFileSync(new URL('./next-work-page.js', import.meta.url), 'utf8');
  assert.match(html, /SAMPLE ONLY/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /id="nextWorkBoard"/);
  assert.match(html, /id="nextWorkDestinations"/);
  assert.match(html, /src="\.\/next-work-page.js"/);
  assert.doesNotMatch(html, /src="\.\/app.js"/);
  assert.match(entry, /void initStoneTodos\(\)/);
  assert.deepEqual([...entry.matchAll(/^import .* from '([^']+)'/gm)].map(m => m[1]), ['./stone-todos.js']);
  assert.doesNotMatch(entry, /\b(?:fetch|XMLHttpRequest|WebSocket|mcpCall|operatorCall|send_message|commit_v2|set_head|set_path_head)\s*\(/);
});