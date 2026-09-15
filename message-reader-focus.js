/**
 * Message Reader focus / navigation helpers (presentation only).
 * Mobile: focused detail sheet over Inbox/Activity. Desktop: inline reader + scroll-into-view.
 * Does not mutate AC1 message stones or chain/path HEADs.
 */

/** Matches styles.css shell breakpoint (min-width: 860px = desktop). */
export const MESSAGE_READER_BREAKPOINT = 860;

export const MESSAGE_READER_SHEET_ID = 'messageReaderSheet';

export function shouldUseFocusedReader(width = globalThis.innerWidth) {
  const w = Number(width);
  if (!Number.isFinite(w)) return true;
  return w < MESSAGE_READER_BREAKPOINT;
}

/**
 * Snapshot list + page scroll so Back/Close can restore position after re-render.
 * Message lists are usually document-scrolled (not an overflow container).
 * @param {HTMLElement | null | undefined} el
 */
export function captureListScroll(el) {
  const windowY = typeof globalThis.scrollY === 'number'
    ? globalThis.scrollY
    : (globalThis.document?.documentElement?.scrollTop || 0);
  if (!el) {
    return { scrollTop: 0, listId: null, windowY: Number(windowY) || 0 };
  }
  return {
    scrollTop: Number(el.scrollTop) || 0,
    listId: el.id || null,
    windowY: Number(windowY) || 0
  };
}

/**
 * @param {HTMLElement | null | undefined} el
 * @param {{ scrollTop?: number, windowY?: number } | null | undefined} snapshot
 */
export function restoreListScroll(el, snapshot) {
  if (!snapshot) return false;
  if (el) {
    const y = Number(snapshot.scrollTop);
    el.scrollTop = Number.isFinite(y) ? y : 0;
  }
  const wy = Number(snapshot.windowY);
  if (Number.isFinite(wy) && typeof globalThis.scrollTo === 'function') {
    try { globalThis.scrollTo(0, wy); } catch { /* ignore */ }
  }
  return true;
}

/**
 * Move accessible focus to the reader title after load (or during loading).
 * @param {HTMLElement | null | undefined} titleEl
 */
export function focusReaderTitle(titleEl, { preventScroll = true } = {}) {
  if (!titleEl || typeof titleEl.focus !== 'function') return false;
  if (!titleEl.hasAttribute('tabindex')) titleEl.setAttribute('tabindex', '-1');
  try {
    titleEl.focus({ preventScroll });
  } catch {
    titleEl.focus();
  }
  const active = globalThis.document?.activeElement;
  if (!active) return true;
  return active === titleEl || Boolean(titleEl.contains?.(active));
}

export function readerLoadingCopy() {
  return {
    title: 'Loading…',
    body: 'Fetching message… Reading may update delivery state only; the message stone remains immutable.'
  };
}

export function readerErrorCopy(err) {
  const message = err && typeof err === 'object' && 'message' in err
    ? String(err.message || 'Unable to read message')
    : String(err || 'Unable to read message');
  return {
    title: 'Read failed',
    body: message
  };
}

/**
 * Decide whether Activity selection should navigate to the Inbox panel.
 * Mobile focused sheet stays on Activity; desktop uses the inline Inbox reader.
 */
export function shouldNavigateToInboxForRead({ source, useFocusedReader } = {}) {
  return source === 'activity' && !useFocusedReader;
}

/**
 * History helper: open pushes one entry; close pops only if this session pushed it.
 */
export function shouldPushReaderHistory(alreadyPushed) {
  return !alreadyPushed;
}

export function shouldPopReaderHistory({ historyPushed, fromPopstate } = {}) {
  return Boolean(historyPushed) && !fromPopstate;
}
