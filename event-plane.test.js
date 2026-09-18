/**
 * V7.7.10f event-plane helpers.
 * Run: node --test event-plane.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AGENT_TREE_TOOL,
  EVENT_LIST_TOOL,
  EVENT_SCHEMA,
  TREE_SCHEMA,
  buildAgentTreeArgs,
  buildEventListArgs,
  compileAgentTreeCard,
  compileEventListCard,
  subscribeHonesty,
  summarizeEventCard
} from './event-plane.js';

const root = join(dirname(fileURLToPath(import.meta.url)));

test('missing tools return fail-closed honesty', () => {
  const card = compileEventListCard({}, { toolsAvailable: false });
  assert.equal(card.ok, false);
  assert.equal(card.error, 'tool_unavailable');
  assert.equal(card.accepted_state_authority, false);
  assert.match(card.honesty, /Poll stays blocked/i);

  const tree = compileAgentTreeCard({}, { toolsAvailable: false });
  assert.equal(tree.ok, false);
  assert.equal(tree.error, 'tool_unavailable');
  assert.match(tree.honesty, /never invents events/i);
});

test('event args allowlist strips extras and authority', () => {
  assert.deepEqual(buildEventListArgs({
    actor_id: 'console:jared',
    task_run_id: 'tr:1',
    status: 'proposed',
    since: '2026-09-17T00:00:00Z',
    limit: 25,
    accepted_state_authority: true,
    root_task_run_id: 'tr:2'
  }), {
    actor_id: 'console:jared',
    task_run_id: 'tr:1',
    status: 'proposed',
    since: '2026-09-17T00:00:00Z',
    limit: 25
  });

  assert.deepEqual(buildAgentTreeArgs({
    actor_id: 'console:jared',
    root_task_run_id: 'tr:root',
    limit: 10,
    status: 'queued',
    accepted_state_authority: true
  }), {
    actor_id: 'console:jared',
    root_task_run_id: 'tr:root',
    limit: 10
  });
});

test('proposed event renders with event rows and false authority', () => {
  const card = compileEventListCard({
    ok: true,
    events: [
      { event_type: 'task_run.proposed', task_run_id: 'tr:123', status: 'proposed', dispatch_state: 'awaiting_human_commit' }
    ]
  }, { toolsAvailable: true });
  assert.equal(card.ok, true);
  assert.equal(card.schema, EVENT_SCHEMA);
  assert.equal(card.tool, EVENT_LIST_TOOL);
  assert.equal(card.accepted_state_authority, false);
  assert.equal(card.events[0].event_type, 'task_run.proposed');
  assert.ok(card.lines.some(line => /task_run\.proposed · tr:123 · proposed · awaiting_human_commit/.test(line)));
  assert.match(summarizeEventCard(card), /Accepted-state authority: false/);
});

test('agent tree renders children with depth and no live ws claim', () => {
  const card = compileAgentTreeCard({
    ok: true,
    roots: [
      {
        task_run_id: 'tr:root',
        status: 'proposed',
        dispatch_state: 'awaiting_human_commit',
        children: [
          { task_run_id: 'tr:child', status: 'queued', dispatch_state: 'queued' }
        ]
      }
    ]
  }, { toolsAvailable: true });
  assert.equal(card.ok, true);
  assert.equal(card.schema, TREE_SCHEMA);
  assert.equal(card.tool, AGENT_TREE_TOOL);
  assert.equal(card.accepted_state_authority, false);
  assert.ok(card.lines.some(line => /Depth 0: tr:root/.test(line)));
  assert.ok(card.lines.some(line => /Depth 1: tr:child/.test(line)));
  assert.ok(card.lines.some(line => /no live WS/i));
});

test('subscribe honesty stays poll-only and upgrade blocked', () => {
  const honesty = subscribeHonesty();
  assert.equal(honesty.ok, false);
  assert.equal(honesty.error, 'upgrade_unavailable');
  assert.equal(honesty.accepted_state_authority, false);
  assert.match(honesty.honesty, /no live WebSocket/i);
});

test('module and work wiring avoid head mutation calls', () => {
  const source = readFileSync(join(root, 'event-plane.js'), 'utf8');
  const app = readFileSync(join(root, 'app.js'), 'utf8');
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(source, /set_head|set_path_head/);
  assert.match(app, /compileEventListCard|compileAgentTreeCard|buildEventListArgs|buildAgentTreeArgs/);
  assert.match(app, /eventPollButton|eventTreeButton|eventResult|eventTaskRunId/);
  assert.match(html, /data-cairn-target="work\.events"/);
  assert.match(html, /id="eventPollButton"/);
  assert.match(html, /id="eventTreeButton"/);
  assert.match(html, /id="eventResult"/);
  assert.match(html, /id="eventTaskRunId"/);
});
