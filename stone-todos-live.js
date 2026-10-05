import { initStoneTodos } from './stone-todos.js';

export const LIVE_NEXT_WORK_CHAIN = 'cairnstone-v6-project-memory';
export const LIVE_NEXT_WORK_TOOL = 'cairnstone_resume_chain';
const SIGN_IN_ERROR = 'Core sign-in required. Connect your Core account in Runtime settings, then refresh Live. SAMPLE cards below are not live work.';

/** Project only the exact returned start_here; never substitute fixtures or a HEAD guess. */
export function projectStartHere(response) {
  if (!response || response.ok === false) throw new Error(response?.error || 'Live read failed');
  const source = response.start_here;
  if (!source || typeof source !== 'object') throw new Error('Live read did not return start_here');
  const requiredText = (value, field) => {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Live start_here is missing ${field}`);
    return value;
  };
  const hash = requiredText(source.stone_hash, 'stone hash');
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error('Live start_here has an invalid stone hash');
  return {
    todo_id: `start_here:${hash}`,
    title: requiredText(source.title, 'title'),
    why_next: `Next: ${requiredText(source.next, 'next')}`,
    destination_actor: 'grok:cairnstone-v6',
    asked_outcome: source.next,
    source_stone_hash: hash,
    source_path: requiredText(source.path, 'path'),
    status: requiredText(source.status ?? source.metadata?.status, 'status'),
    sequence: 1,
    live: true,
    sample: false
  };
}

/** Only read capability is injected. No transport, credentials, persistence, or writes. */
export function initLiveNextWork({
  root,
  status,
  refreshButton,
  read,
  sessionKey,
  clipboard = globalThis.navigator?.clipboard
}) {
  if (!root || !status || !refreshButton) return null;
  let revision = 0;
  const message = (text, state) => {
    root.replaceChildren();
    root.dataset.state = state;
    status.textContent = text;
  };
  const clear = () => {
    revision += 1;
    message(sessionKey() ? 'Open Next Work or refresh Live to read the current start_here.' : SIGN_IN_ERROR,
      sessionKey() ? 'idle' : 'signed-out');
  };
  const refresh = async () => {
    const attempt = ++revision;
    const identity = sessionKey();
    if (!identity) {
      message(SIGN_IN_ERROR, 'signed-out');
      return;
    }
    message('Loading Live start_here…', 'loading');
    try {
      const response = await read(LIVE_NEXT_WORK_TOOL, { chain: LIVE_NEXT_WORK_CHAIN, detail: 'start_here' });
      if (attempt !== revision || sessionKey() !== identity) return;
      const card = projectStartHere(response);
      // Render off-screen so an older response cannot overwrite a newer refresh/sign-out.
      const container = root.ownerDocument.createElement('div');
      await initStoneTodos({ root: container, reader: { async list() { return [card]; } }, clipboard });
      if (attempt !== revision || sessionKey() !== identity) return;
      root.replaceChildren(...container.childNodes);
      root.dataset.state = 'live';
      status.textContent = 'Live start_here · read-only projection. This board grants no authority. Nothing was sent.';
    } catch (error) {
      if (attempt !== revision || sessionKey() !== identity) return;
      message(`Live unavailable: ${error?.message || 'Read failed'}. SAMPLE cards below remain samples.`, 'error');
    }
  };
  refreshButton.addEventListener('click', () => { void refresh(); });
  clear();
  return Object.freeze({ refresh, clear });
}
