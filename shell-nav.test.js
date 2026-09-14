import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'styles.css'), 'utf8');
const app = readFileSync(join(root, 'app.js'), 'utf8');

test('primary IA is Chat · Work · Universe · Inbox · More', () => {
  for (const nav of ['chat', 'work', 'universe', 'inbox', 'more']) {
    assert.match(html, new RegExp(`data-nav="${nav}"`));
  }
  assert.doesNotMatch(html, /class="tabs"/);
  assert.equal((html.match(/class="nav-bottom"/g) || []).length, 1);
  assert.equal((html.match(/class="nav-rail"/g) || []).length, 1);
});

test('legacy capabilities remain reachable as panels or sheets', () => {
  for (const id of [
    'panel-chat', 'panel-code', 'panel-universe', 'panel-inbox', 'panel-handoff', 'panel-activity',
    'panel-stones', 'panel-evidence', 'panel-authorize', 'panel-invite', 'panel-settings',
    'scopeSheet', 'runtimeSheet', 'universeOverlay',
    'answerDepthControls', 'codeSessionId', 'operatorToken', 'taskInput'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('dense 3×3 top tab matrix styles are gone; bottom nav + rail exist', () => {
  assert.match(css, /\.nav-bottom\s*\{/);
  assert.match(css, /\.nav-rail\s*\{/);
  assert.match(css, /\.context-bar\s*\{/);
  assert.doesNotMatch(css, /\.tabs\{grid-template-columns:repeat\(3/);
});

test('navigation mapping keeps Work→code and More/Inbox sub-routes', () => {
  assert.match(app, /PRIMARY_BY_PANEL/);
  assert.match(app, /code:\s*'work'/);
  assert.match(app, /handoff:\s*'inbox'/);
  assert.match(app, /authorize:\s*'more'/);
  assert.match(app, /DEFAULT_PANEL_BY_PRIMARY/);
  assert.match(app, /work:\s*'code'/);
});

test('context bar sync helpers exist without inventing authority APIs', () => {
  assert.match(app, /function syncContextBar/);
  assert.match(app, /function openSheet/);
  assert.doesNotMatch(app, /accepted_state_authority:\s*true/);
  assert.doesNotMatch(html, /Bearer [A-Za-z0-9._-]{20,}/);
});
