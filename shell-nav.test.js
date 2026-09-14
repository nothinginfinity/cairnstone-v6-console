import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'styles.css'), 'utf8');
const app = readFileSync(join(root, 'app.js'), 'utf8');
const codeSession = readFileSync(join(root, 'code-session.js'), 'utf8');

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
    'scopeSheet', 'runtimeSheet', 'chatConfigSheet', 'evidenceDrawer', 'savedViewsSheet', 'universeOverlay',
    'answerDepthControls', 'codeSessionId', 'operatorToken', 'taskInput', 'openChatConfig', 'openEvidenceDrawer',
    'contextViewsBtn', 'savedViewSave', 'stonesRawBlock', 'authorizeRawBlock', 'evidenceDisclosure'
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
  assert.match(app, /chatConfigSheet/);
  assert.match(app, /evidenceDrawer/);
  assert.match(app, /openEvidenceDrawerForResult/);
  assert.doesNotMatch(app, /accepted_state_authority:\s*true/);
  assert.doesNotMatch(html, /Bearer [A-Za-z0-9._-]{20,}/);
});

test('Chat first paint keeps route/model in config sheet, not primary Ask card', () => {
  const chatStart = html.indexOf('id="panel-chat"');
  const chatEnd = html.indexOf('id="panel-universe"');
  const chat = html.slice(chatStart, chatEnd);
  assert.match(chat, /id="answerDepthDefaults"/);
  assert.match(chat, /id="answerDepthControls"/);
  assert.match(chat, /id="openChatConfig"/);
  assert.doesNotMatch(chat, /id="providerSelect"/);
  assert.doesNotMatch(chat, /id="modelSelect"/);
  assert.doesNotMatch(chat, /id="runtimeUrl"/);
  assert.match(html, /id="chatConfigSheet"/);
  assert.match(html, /id="providerSelect"/);
});

test('Work first paint is task-oriented with progressive disclosure', () => {
  const start = html.indexOf('id="panel-code"');
  const end = html.indexOf('id="panel-invite"');
  const work = html.slice(start, end);
  assert.match(work, /work-task-hero|Current task/);
  assert.match(work, /id="codeCurrentTask"/);
  assert.match(work, /id="codeEmptyState"/);
  assert.match(work, /id="codeActionCatalog"/);
  assert.match(work, /id="codeEnvironment"/);
  assert.match(work, /work-details/);
  assert.match(work, /Propose \/ Merge/);
  assert.match(codeSession, /workFirstPaintModel|work-surface/);
});

test('Communications hub keeps Inbox · Handoff · Activity with shared list patterns', () => {
  assert.match(html, /aria-label="Communications: Inbox, Handoff, Activity"/);
  assert.match(html, /comms-hub-card/);
  assert.match(html, /id="inboxGroupThreads"/);
  assert.match(html, /id="inboxHubBlurb"/);
  assert.match(html, /id="handoffHubBlurb"/);
  assert.match(html, /id="activityHubBlurb"/);
  assert.match(app, /normalizeMessageRow/);
  assert.match(app, /groupMessagesByThread/);
  assert.match(app, /handoffChainAllowed/);
  assert.match(app, /syncCommsHub/);
  assert.doesNotMatch(app, /accepted_state_authority:\s*true/);
});

test('Universe v2 exposes semantic zoom and list/grid parity controls', () => {
  assert.match(html, /id="universeZoomIn"/);
  assert.match(html, /id="universeZoomOut"/);
  assert.match(html, /id="universeViewSpatial"/);
  assert.match(html, /id="universeViewList"/);
  assert.match(html, /id="universeViewGrid"/);
  assert.match(html, /id="universeGrid"/);
  assert.match(html, /id="universeIntelPanel"/);
  assert.match(html, /Vault → Repo → Chain → Intelligence|semantic zoom/i);
  assert.match(app, /universe-v2/);
  assert.match(app, /buildUniverseEntities/);
  assert.match(app, /searchToFocus|focusUniverseSearch/);
  assert.match(app, /cairnstone_resume_chain/);
  assert.doesNotMatch(app, /accepted_state_authority:\s*true/);
});

test('V7.7.9e progressive disclosure + Saved Views stay presentation-only', () => {
  assert.match(html, /id="savedViewsSheet"/);
  assert.match(html, /id="contextViewsBtn"/);
  assert.match(html, /progressive-disclosure|progressive-details/);
  assert.match(html, /id="stonesRawBlock"/);
  assert.match(html, /id="authorizeRawBlock"/);
  assert.match(html, /id="scopeAdvanced"/);
  assert.match(app, /saved-views/);
  assert.match(app, /openSavedView|captureCurrentView|upsertSavedView/);
  assert.match(app, /progressive-disclosure/);
  assert.match(app, /cairnstone_resolve_scope/);
  assert.match(app, /mustResolveScope|re-resolv/i);
  assert.doesNotMatch(app, /accepted_state_authority:\s*true/);
  assert.doesNotMatch(html, /Bearer [A-Za-z0-9._-]{20,}/);
});
