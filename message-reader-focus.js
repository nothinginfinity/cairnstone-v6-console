/**
 * Message Reader focus / navigation helpers (presentation only).
 * Mobile: focused detail sheet over Inbox/Activity. Desktop: inline reader + scroll-into-view.
 * Does not mutate AC1 message stones or chain/path HEADs.
 */

/**
 * Matches styles.css shell breakpoint (min-width: 860px = desktop).
 * Prefer matchMedia so JS and CSS stay aligned under device emulation.
 */
export const MESSAGE_READER_BREAKPOINT = 860;

export const MESSAGE_READER_SHEET_ID = 'messageReaderSheet';

export const MESSAGE_READER_MEDIA_QUERY = `(max-width: ${MESSAGE_READER_BREAKPOINT - 1}px)`;

/**
 * @param {number | { matches?: boolean } | null | undefined} widthOrMedia
 *   - number: treat as viewport width in px (tests / explicit)
 *   - MediaQueryList-like: use .matches
 *   - omitted: use matchMedia(MESSAGE_READER_MEDIA_QUERY) or innerWidth fallback
 */
export function shouldUseFocusedReader(widthOrMedia = undefined) {
  if (typeof widthOrMedia === 'number') {
    const w = Number(widthOrMedia);
    if (!Number.isFinite(w)) return true;
    return w < MESSAGE_READER_BREAKPOINT;
  }
  if (widthOrMedia && typeof widthOrMedia === 'object' && 'matches' in widthOrMedia) {
    return Boolean(widthOrMedia.matches);
  }
  if (typeof globalThis.matchMedia === 'function') {
    try {
      return Boolean(globalThis.matchMedia(MESSAGE_READER_MEDIA_QUERY).matches);
    } catch {
      /* fall through */
    }
  }
  const w = Number(globalThis.innerWidth);
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

/**
 * Estimate sticky Console chrome height so scroll-into-view is not covered by the context bar.
 * @param {ParentNode | null | undefined} root
 */
export function stickyChromeOffset(root = globalThis.document) {
  const bar = root?.querySelector?.('.context-bar');
  if (!bar || typeof bar.getBoundingClientRect !== 'function') return 0;
  const h = bar.getBoundingClientRect().height;
  return Number.isFinite(h) ? Math.ceil(h) : 0;
}

/**
 * Bring the inline Message Reader into the viewport immediately (desktop path).
 * Uses instant scroll — smooth animation races quiet list refresh and can leave the reader off-screen.
 * @param {HTMLElement | null | undefined} el
 */
export function scrollReaderIntoView(el, {
  stickyOffset = 0,
  scrollToFn = globalThis.scrollTo?.bind(globalThis),
  getScrollY = () => (typeof globalThis.scrollY === 'number'
    ? globalThis.scrollY
    : (globalThis.document?.documentElement?.scrollTop || 0))
} = {}) {
  if (!el) return false;
  try {
    el.scrollIntoView({ behavior: 'auto', block: 'start' });
  } catch {
    try { el.scrollIntoView(true); } catch { return false; }
  }
  const pad = Number(stickyOffset) || 0;
  if (pad > 0 && typeof scrollToFn === 'function' && typeof el.getBoundingClientRect === 'function') {
    const top = el.getBoundingClientRect().top;
    if (Number.isFinite(top) && top < pad + 4) {
      const y = getScrollY() + top - pad - 8;
      try {
        scrollToFn({ top: Math.max(0, y), left: 0, behavior: 'auto' });
      } catch {
        try { scrollToFn(0, Math.max(0, y)); } catch { /* ignore */ }
      }
    }
  }
  return true;
}

/**
 * True when the reader's top edge is in the visible viewport (below sticky chrome).
 */
export function readerIsInView(el, {
  stickyOffset = 0,
  viewportHeight = typeof globalThis.innerHeight === 'number' ? globalThis.innerHeight : 800
} = {}) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;
  const r = el.getBoundingClientRect();
  const topMin = (Number(stickyOffset) || 0) + 4;
  const topMax = Math.max(topMin + 40, (Number(viewportHeight) || 800) * 0.85);
  return r.top >= topMin - 2 && r.top <= topMax && r.bottom > topMin;
}
