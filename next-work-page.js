import { initStoneTodos, NEXT_WORK_DESTINATIONS } from './stone-todos.js';

// Standalone preview: imports only the fixture-backed read-only board, not app.js.
const directory = document.getElementById('nextWorkDestinations');
for (const [actor, note] of Object.entries(NEXT_WORK_DESTINATIONS)) {
  const row = document.createElement('p');
  row.className = 'small stone-todo-destination';
  row.textContent = `${actor} — ${note}`;
  directory.append(row);
}
void initStoneTodos();