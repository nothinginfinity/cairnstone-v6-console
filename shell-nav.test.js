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
    'panel-stones', 'panel-evidence', 'panel-access', 'panel-authorize', 'panel-invite', 'panel-settings',
    'scopeSheet', 'runtimeSheet', 'chatConfigSheet', 'evidenceDrawer', 'savedViewsSheet', 'messageReaderSheet', 'shareSheet', 'universeOverlay',
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
  assert.match(html, /id="contextChatBtn"/);
  assert.match(html, /id="contextCodeBtn"/);
  assert.match(html, />Chat</);
  assert.match(app, /contextChatLabel/);
  assert.match(app, /contextCodeLabel/);
  assert.match(app, /initWorkGuidePanel/);
  // Legacy Session pill removed — Chat + Code only (Code hidden until bound).
  assert.doesNotMatch(html, /id="contextSessionBtn"/);
  assert.doesNotMatch(html, /id="contextSessionLabel"/);
  assert.doesNotMatch(html, /class="context-k">Session</);
  assert.doesNotMatch(app, /contextSessionBtn/);
  assert.doesNotMatch(app, /contextSessionLabel/);
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

test('Message Reader focus opens a mobile sheet and preserves list context', () => {
  assert.match(html, /id="messageReaderSheet"/);
  assert.match(html, /id="messageReaderBack"/);
  assert.match(html, /id="messageReaderCard"/);
  assert.match(html, /id="messageReaderSheetTitle"/);
  assert.match(html, /messageTitle" tabindex="-1"/);
  assert.match(css, /\.message-reader-panel/);
  assert.match(css, /scroll-margin-top/);
  assert.match(css, /@media\(max-width:859px\)/);
  assert.match(app, /message-reader-focus/);
  assert.match(app, /openMessageReaderFocus|closeMessageReaderFocus/);
  assert.match(app, /shouldUseFocusedReader/);
  assert.match(app, /scrollReaderIntoView|revealInlineMessageReader/);
  assert.match(app, /cairnstone_read_message/);
  assert.doesNotMatch(app, /accepted_state_authority:\s*true/);
});

test('Actor Inbox Navigator is shared across Inbox · Handoff · Activity', () => {
  assert.match(html, /id="inboxActorPicker"/);
  assert.match(html, /id="inboxPlaneTabs"/);
  assert.match(html, /id="activityActorPicker"/);
  assert.match(html, /id="handoffActorPicker"/);
  assert.match(html, /Choose inbox|Whose activity\?|Choose recipients/);
  assert.match(html, /Advanced \/ Custom Actor ID/);
  assert.doesNotMatch(html, /Actor IDs \(comma-separated; each inbox is queried independently\)/);
  assert.match(app, /actor-inbox-nav/);
  assert.match(app, /renderAllActorNavigators/);
  assert.match(app, /cairnstone-v6/);
  assert.doesNotMatch(app, /WORK_SUFFIX\s*=\s*['"]cairnstone-v7['"]/);
  assert.match(css, /\.actor-inbox-nav/);
  assert.match(css, /\.actor-picker/);
  assert.match(css, /\.mailbox-planes/);
});

test('V7.7.10b Give Access / Assign / Forward share sheet + Access panel', () => {
  assert.match(html, /id="shareSheet"/);
  assert.match(html, /id="panel-access"/);
  assert.match(html, /Give access…/);
  assert.match(html, /Assign \/ Ask to work/);
  assert.match(html, /Forward with note/);
  assert.match(html, /id="shareActorPicker"/);
  assert.match(html, /id="shareHumanCommit"/);
  assert.match(html, /data-panel="access"/);
  assert.match(app, /access-share/);
  assert.match(app, /ACCESS_GRANT_TOOLS|cairnstone_access_grant/);
  assert.match(app, /openShareSheet/);
  assert.match(app, /Human Commit|shareHumanCommit/);
  assert.doesNotMatch(app, /mcpCall\(\s*['"]cairnstone_set_head['"]/);
  assert.doesNotMatch(app, /mcpCall\(\s*['"]cairnstone_set_path_head['"]/);
  assert.match(css, /\.share-actions/);
  assert.match(css, /\.share-commit-row/);
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
