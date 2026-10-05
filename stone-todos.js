import { STONE_TODOS_FIXTURE } from './stone-todos-fixture.js';

export const NEXT_WORK_DESTINATIONS = Object.freeze({
  'grok:cairnstone-v6': 'Paste into the live Grok CairnStone v6 chat.',
  'chatgpt:cairnstone-v6': 'Paste into the live ChatGPT CairnStone v6 chat.',
  'claude:cairnstone-v6': 'Paste into the live Claude CairnStone v6 chat.',
  'grok-bot:cairnstone-v6': 'Paste into the live Grok bot CairnStone v6 conversation.',
  'replit:cairnstone-v6': 'Paste into the live Replit CairnStone v6 Agent chat.'
});

function validateCard(card) {
  for (const key of ['todo_id', 'title', 'why_next', 'destination_actor', 'asked_outcome', 'source_stone_hash', 'source_path', 'status']) {
    if (typeof card?.[key] !== 'string' || !card[key].trim()) throw new Error(`Missing card field: ${key}`);
  }
  if (!Object.hasOwn(NEXT_WORK_DESTINATIONS, card.destination_actor)) throw new Error('Unsupported destination actor');
  if (!/^[a-f0-9]{64}$/i.test(card.source_stone_hash)) throw new Error('Invalid source stone hash');
  if (!card.live && !['ready', 'queued', 'blocked', 'done'].includes(card.status)) throw new Error('Invalid card status');
  if (!Number.isFinite(card.sequence)) throw new Error('Invalid card sequence');
  return card;
}

export function formatStoneTodoPrompt(card) {
  validateCard(card);
  return [
    card.sample ? 'SAMPLE ONLY — placeholder source; not an accepted task. Verify a real source before execution.' : 'Read the exact source before acting; this board grants no authority.',
    `Destination actor: ${card.destination_actor}`,
    `Todo: ${card.todo_id}`,
    `Title: ${card.title}`,
    `Why next: ${card.why_next}`,
    `Status: ${card.status} · Sequence: ${card.sequence}`,
    `Source stone hash: ${card.source_stone_hash}`,
    `Source path: ${card.source_path}`,
    `Asked outcome: ${card.asked_outcome}`,
    ...(card.live ? ['Display-only live projection. Do not execute this handoff from the board. Do not apply migration 0025.'] : []),
    'Stay inside the source scope. Do not infer permissions from this card. If the source is unavailable, report the blocker.',
    'Manual paste handoff only. Do not send AC1, write stones, move HEADs, merge, or deploy.'
  ].join('\n\n');
}

/**
 * Read-only seam: consumers receive list(), never a transport or write capability.
 * A future CairnStone adapter can implement this same contract. v1 is offline.
 */
export function createFixtureTodoReader(cards = STONE_TODOS_FIXTURE) {
  return Object.freeze({
    async list() {
      return cards.map(card => ({ ...validateCard(card) })).sort((a, b) => a.sequence - b.sequence);
    }
  });
}

export async function copyStoneTodoPrompt(card, clipboard = globalThis.navigator?.clipboard) {
  const prompt = formatStoneTodoPrompt(card);
  if (!clipboard?.writeText) throw new Error('Clipboard unavailable. Select and copy the prompt preview manually.');
  await clipboard.writeText(prompt);
  return prompt;
}

/** No MCP client, account secrets, persistence, or write tools enter this view. */
export async function initStoneTodos({
  root = globalThis.document?.getElementById('nextWorkBoard'),
  reader = createFixtureTodoReader(),
  clipboard = globalThis.navigator?.clipboard
} = {}) {
  if (!root) return;
  const doc = root.ownerDocument;
  const element = (tag, className, text) => {
    const node = doc.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  root.replaceChildren(element('p', 'muted', 'Loading Next Work…'));
  try {
    const cards = await reader.list();
    if (!Array.isArray(cards)) throw new Error('Reader must return a list of cards');
    const prompts = cards.map(formatStoneTodoPrompt);
    root.replaceChildren();
    if (!cards.length) root.append(element('p', 'muted', 'No next work returned by the reader.'));
    cards.forEach((card, index) => {
      const article = element('article', 'card stone-todo');
      article.dataset.todoId = card.todo_id;
      const heading = element('div', 'section-heading');
      heading.append(element('h3', '', `${card.sequence}. ${card.title}`), element('span', 'work-pill', card.status));
      article.append(heading);
      if (card.sample) article.append(element('p', 'eyebrow', 'Sample · not accepted work'));
      article.append(element('p', '', card.why_next));
      article.append(element('code', 'stone-todo-actor', card.destination_actor));
      article.append(element('p', 'muted small', NEXT_WORK_DESTINATIONS[card.destination_actor]));
      article.append(element('p', 'small', `Asked outcome: ${card.asked_outcome}`));
      const source = element('dl', 'stone-todo-source');
      source.append(element('dt', '', 'Source stone hash'), element('dd', '', card.source_stone_hash),
        element('dt', '', 'Source path'), element('dd', '', card.source_path));
      article.append(source);
      const preview = element('details', 'stone-todo-preview');
      preview.append(element('summary', '', 'Prompt preview / manual copy'));
      const text = element('textarea', 'stone-todo-prompt');
      text.readOnly = true;
      text.rows = 10;
      text.value = prompts[index];
      text.setAttribute('aria-label', `Prompt for ${card.title}`);
      preview.append(text);
      const button = element('button', 'primary stone-todo-copy', 'Copy prompt');
      button.type = 'button';
      button.setAttribute('aria-label', `Copy prompt for ${card.title}`);
      const feedback = element('p', 'muted small stone-todo-feedback', '');
      feedback.setAttribute('role', 'status');
      feedback.setAttribute('aria-live', 'polite');
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await copyStoneTodoPrompt(card, clipboard);
          feedback.textContent = `Copied. ${NEXT_WORK_DESTINATIONS[card.destination_actor]} Nothing was sent.`;
        } catch {
          feedback.textContent = 'Copy failed. Select and copy the prompt preview manually; nothing was sent.';
          preview.open = true;
          text.focus();
          text.select();
        } finally {
          button.disabled = false;
        }
      });
      article.append(button, feedback, preview);
      root.append(article);
    });
  } catch (err) {
    root.replaceChildren(element('p', 'muted', `Next Work unavailable: ${err.message}`));
  }
}