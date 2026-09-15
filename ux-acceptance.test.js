import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  PRIMARY_IA,
  REACHABILITY_MAP,
  HEAD_MUTATION_TOOLS,
  REDUCED_MOTION_CLASS,
  prefersReducedMotion,
  applyReducedMotionClass,
  reachabilityForPrimary,
  legacyPanelsReachable,
  assertNoPresentationHeadMutation,
  acceptanceViewports
} from './ux-acceptance.js';

const root = join(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'styles.css'), 'utf8');
const app = readFileSync(join(root, 'app.js'), 'utf8');
const acceptanceDoc = readFileSync(join(root, 'docs/V7_7_9F_CROSS_DEVICE_ACCEPTANCE.md'), 'utf8');

test('primary IA map covers Chat · Work · Universe · Inbox · More', () => {
  assert.deepEqual([...PRIMARY_IA], ['chat', 'work', 'universe', 'inbox', 'more']);
  for (const nav of PRIMARY_IA) {
    assert.ok(reachabilityForPrimary(nav).length >= 1, `expected reachability rows for ${nav}`);
  }
});

test('legacy capabilities remain reachable via primary or More/Inbox subnav', () => {
  const panels = new Set(legacyPanelsReachable());
  for (const id of [
    'chat', 'code', 'universe', 'inbox', 'handoff', 'activity',
    'stones', 'evidence', 'authorize', 'invite', 'settings'
  ]) {
    assert.ok(panels.has(id), `missing panel reachability for ${id}`);
    assert.match(html, new RegExp(`id="panel-${id}"`));
  }
  assert.ok(REACHABILITY_MAP.some(r => r.sheet === 'scopeSheet'));
  assert.ok(REACHABILITY_MAP.some(r => r.sheet === 'savedViewsSheet'));
  assert.ok(REACHABILITY_MAP.some(r => r.sheet === 'evidenceDrawer'));
  assert.ok(REACHABILITY_MAP.some(r => r.sheet === 'messageReaderSheet'));
  assert.ok(REACHABILITY_MAP.some(r => r.capability.includes('Authorize')));
});

test('reduced-motion helpers and CSS prefer reduced motion', () => {
  assert.equal(REDUCED_MOTION_CLASS, 'cs-reduced-motion');
  assert.equal(prefersReducedMotion(() => ({ matches: true })), true);
  assert.equal(prefersReducedMotion(() => ({ matches: false })), false);
  const fakeRoot = { classList: { toggled: null, toggle(name, on) { this.toggled = { name, on }; } } };
  assert.equal(applyReducedMotionClass(fakeRoot, () => ({ matches: true })), true);
  assert.deepEqual(fakeRoot.classList.toggled, { name: REDUCED_MOTION_CLASS, on: true });
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /animation:\s*none|transition:\s*none/);
  assert.match(css, /\.cs-reduced-motion|prefers-reduced-motion/);
  assert.match(html, /skip-link|#main-content/);
  assert.match(css, /:focus-visible/);
});

test('presentation paths do not mcpCall set_head / set_path_head', () => {
  const check = assertNoPresentationHeadMutation(app);
  assert.equal(check.ok, true);
  assert.deepEqual(check.mcpHeadCalls, []);
  for (const tool of HEAD_MUTATION_TOOLS) {
    assert.doesNotMatch(app, new RegExp(`mcpCall\\(\\s*['"]${tool}['"]`));
  }
  // Material-effect copy on Authorize may still name HEAD tools.
  assert.match(app, /set_head|set_path_head/);
  assert.match(app, /\/v1\/tool-authorizations/);
  assert.match(app, /decideAuthorization/);
});

test('acceptance viewports and matrix doc exist', () => {
  const vp = acceptanceViewports();
  assert.equal(vp.mobile.width, 390);
  assert.equal(vp.desktop.width, 1280);
  assert.match(acceptanceDoc, /V7\.7\.9f/);
  assert.match(acceptanceDoc, /390.?844|iPhone/i);
  assert.match(acceptanceDoc, /prefers-reduced-motion/i);
  assert.match(acceptanceDoc, /Authorize|set_head|mutation/i);
  assert.match(acceptanceDoc, /0\.5\.38/);
  assert.match(html, /V7\.7\.9f/);
});

test('Saved Views open still requires fresh resolve_scope; response_lod ≠ stone_lod', () => {
  assert.match(app, /openSavedView/);
  assert.match(app, /cairnstone_resolve_scope/);
  assert.match(app, /mustResolveScope|re-resolv|Fresh authority/i);
  assert.match(html, /response_lod|Answer Depth/i);
  assert.match(html, /stone_lod/);
  assert.doesNotMatch(app, /accepted_state_authority:\s*true/);
});
