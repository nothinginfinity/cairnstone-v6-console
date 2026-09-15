/**
 * Message Reader focus helpers — unit tests.
 * Run: node --test message-reader-focus.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MESSAGE_READER_BREAKPOINT,
  MESSAGE_READER_SHEET_ID,
  shouldUseFocusedReader,
  captureListScroll,
  restoreListScroll,
  focusReaderTitle,
  readerLoadingCopy,
  readerErrorCopy,
  shouldNavigateToInboxForRead,
  shouldPushReaderHistory,
  shouldPopReaderHistory,
  stickyChromeOffset,
  scrollReaderIntoView,
  readerIsInView
} from './message-reader-focus.js';

test('focused reader uses mobile breakpoint matching shell CSS', () => {
  assert.equal(MESSAGE_READER_BREAKPOINT, 860);
  assert.equal(MESSAGE_READER_SHEET_ID, 'messageReaderSheet');
  assert.equal(shouldUseFocusedReader(389), true);
  assert.equal(shouldUseFocusedReader(390), true);
  assert.equal(shouldUseFocusedReader(859), true);
  assert.equal(shouldUseFocusedReader(860), false);
  assert.equal(shouldUseFocusedReader(1280), false);
  assert.equal(shouldUseFocusedReader({ matches: true }), true);
  assert.equal(shouldUseFocusedReader({ matches: false }), false);
});

test('list scroll capture/restore round-trips', () => {
  const el = { id: 'inboxList', scrollTop: 240 };
  const snap = captureListScroll(el);
  assert.equal(snap.scrollTop, 240);
  assert.equal(snap.listId, 'inboxList');
  assert.equal(typeof snap.windowY, 'number');
  el.scrollTop = 0;
  assert.equal(restoreListScroll(el, snap), true);
  assert.equal(el.scrollTop, 240);
  assert.equal(restoreListScroll(null, { scrollTop: 0, windowY: 0 }), true);
  assert.ok(captureListScroll(null));
});

test('focusReaderTitle sets tabindex and focuses', () => {
  const calls = [];
  const titleEl = {
    hasAttribute(name) { return name === 'tabindex' ? this._tab != null : false; },
    setAttribute(name, value) { if (name === 'tabindex') this._tab = value; },
    focus(opts) { calls.push(opts); this._focused = true; },
    contains() { return false; }
  };
  // jsdom-less: document.activeElement may be undefined; still assert focus() called
  const ok = focusReaderTitle(titleEl, { preventScroll: true });
  assert.equal(titleEl._tab, '-1');
  assert.deepEqual(calls[0], { preventScroll: true });
  assert.equal(typeof ok, 'boolean');
  assert.equal(focusReaderTitle(null), false);
});

test('loading and error copy stay honest', () => {
  const loading = readerLoadingCopy();
  assert.match(loading.title, /Loading/i);
  assert.match(loading.body, /delivery state only/i);
  const err = readerErrorCopy(new Error('timeout'));
  assert.equal(err.title, 'Read failed');
  assert.equal(err.body, 'timeout');
});

test('Activity stays under sheet on mobile; desktop may navigate to Inbox', () => {
  assert.equal(shouldNavigateToInboxForRead({ source: 'activity', useFocusedReader: true }), false);
  assert.equal(shouldNavigateToInboxForRead({ source: 'activity', useFocusedReader: false }), true);
  assert.equal(shouldNavigateToInboxForRead({ source: 'inbox', useFocusedReader: false }), false);
  assert.equal(shouldNavigateToInboxForRead({ source: 'inbox', useFocusedReader: true }), false);
});

test('history push/pop helpers avoid double-close', () => {
  assert.equal(shouldPushReaderHistory(false), true);
  assert.equal(shouldPushReaderHistory(true), false);
  assert.equal(shouldPopReaderHistory({ historyPushed: true, fromPopstate: false }), true);
  assert.equal(shouldPopReaderHistory({ historyPushed: true, fromPopstate: true }), false);
  assert.equal(shouldPopReaderHistory({ historyPushed: false, fromPopstate: false }), false);
});

test('desktop scrollReaderIntoView is immediate and accounts for sticky chrome', () => {
  const calls = [];
  const scrollCalls = [];
  const el = {
    scrollIntoView(opts) { calls.push(opts); },
    getBoundingClientRect() { return { top: 12, bottom: 200, height: 188 }; }
  };
  assert.equal(scrollReaderIntoView(null), false);
  assert.equal(scrollReaderIntoView(el, {
    stickyOffset: 64,
    scrollToFn: (arg) => scrollCalls.push(arg),
    getScrollY: () => 400
  }), true);
  assert.deepEqual(calls[0], { behavior: 'auto', block: 'start' });
  assert.equal(scrollCalls.length, 1);
  assert.equal(scrollCalls[0].behavior, 'auto');
  assert.ok(scrollCalls[0].top < 400);
  assert.equal(stickyChromeOffset({ querySelector: () => null }), 0);
  assert.equal(stickyChromeOffset({
    querySelector: () => ({ getBoundingClientRect: () => ({ height: 56.2 }) })
  }), 57);
  assert.equal(readerIsInView(el, { stickyOffset: 64, viewportHeight: 800 }), false);
  assert.equal(readerIsInView({
    getBoundingClientRect: () => ({ top: 80, bottom: 400 })
  }, { stickyOffset: 64, viewportHeight: 800 }), true);
});
