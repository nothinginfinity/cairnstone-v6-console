/**
 * V7.7.10e intent route / dispatch helpers.
 * Run: node --test intent-proposal.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INTENT_PROPOSAL_SCHEMA,
  DISPATCH_COMMIT_SCHEMA,
  INTENT_TOOLS,
  compileIntentProposalCard,
  buildIntentRouteArgs,
  commitProposalTool,
  compileDispatchCommitCard,
  buildDispatchCommitArgs,
  summarizeProposalCard,
  pickAllowedArgs
} from './intent-proposal.js';

const root = join(dirname(fileURLToPath(import.meta.url)));

test('route args require text', () => {
  const blocked = buildIntentRouteArgs({});
  assert.equal(blocked.ok, false);
  assert.match(blocked.errors[0], /text/i);

  const ready = buildIntentRouteArgs({
    text: 'Assign this task to Claude',
    actor_id: 'console:jared',
    code_session_id: 'cs:1'
  });
  assert.equal(ready.ok, true);
  assert.equal(ready.args.text, 'Assign this task to Claude');
  assert.equal(ready.args.actor_id, 'console:jared');
  assert.equal(ready.args.code_session_id, undefined);
  assert.equal(ready.args.context.code_session_id, 'cs:1');
});

test('live 10c tool_id proposal compiles', () => {
  const card = compileIntentProposalCard({
    intent: 'assign',
    confidence: 'high',
    requires_human_commit: true,
    auto_mutated: false,
    proposal: {
      tool_id: 'cairnstone_task_run_propose',
      args: {
        requested_by: 'console:jared',
        assignee_actor_id: 'claude:cairnstone-v6',
        attachment_refs: ['msg:demo']
      },
      missing_fields: []
    }
  });
  assert.equal(card.ok, true);
  assert.equal(card.proposal.mcp_tool, INTENT_TOOLS.propose);
  assert.equal(card.next_action, 'propose_task_run');
});

test('assign card requires human commit and does not dispatch', () => {
  const card = compileIntentProposalCard({
    ok: true,
    intent: 'assign',
    proposal: {
      mcp_tool: INTENT_TOOLS.propose,
      mcp_args: {
        task_run_id: 'tr:123',
        assignee_actor_id: 'claude:cairnstone-v6',
        requested_by: 'console:jared',
        note: 'Please investigate'
      }
    }
  });
  assert.equal(card.ok, true);
  assert.equal(card.require_human_commit, true);
  assert.equal(card.human_commit_required, true);
  assert.equal(card.auto_mutated, false);
  assert.equal(card.dispatched, false);
  assert.equal(card.accepted_state_authority, false);
  assert.equal(card.next_action, 'propose_task_run');
  assert.equal(card.proposal.mcp_tool, INTENT_TOOLS.propose);
  assert.equal(card.task_run_id, 'tr:123');
});

test('commit without checkbox fails closed', () => {
  const result = commitProposalTool({
    ok: true,
    require_human_commit: true,
    proposal: {
      mcp_tool: INTENT_TOOLS.propose,
      args: { task_run_id: 'tr:123', note: 'Please investigate' }
    }
  }, {
    human_commit: false,
    committed_by: 'console:jared'
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'human_commit_required');
});

test('commit requires committed_by', () => {
  const result = commitProposalTool({
    ok: true,
    require_human_commit: false,
    proposal: {
      mcp_tool: INTENT_TOOLS.propose,
      args: { task_run_id: 'tr:123' }
    }
  }, {
    human_commit: false,
    committed_by: ''
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'committed_by_required');
});

test('commit with checkbox returns propose tool args without dispatch', () => {
  const card = compileIntentProposalCard({
    ok: true,
    intent: 'assign',
    proposal: {
      mcp_tool: INTENT_TOOLS.propose,
      mcp_args: {
        task_run_id: 'tr:123',
        requested_by: 'console:jared',
        assignee_actor_id: 'claude:cairnstone-v6',
        note: 'Please investigate',
        accepted_state_authority: true
      }
    }
  });
  const result = commitProposalTool(card, {
    human_commit: true,
    committed_by: 'console:jared'
  });
  assert.equal(result.ok, true);
  assert.equal(result.mcp_tool, INTENT_TOOLS.propose);
  assert.equal(result.dispatched, false);
  assert.equal(result.accepted_state_authority, false);
  assert.deepEqual(result.args, {
    task_run_id: 'tr:123',
    requested_by: 'console:jared',
    assignee_actor_id: 'claude:cairnstone-v6',
    note: 'Please investigate'
  });
});

test('blocked proposal card cannot be committed', () => {
  const result = commitProposalTool({
    ok: false,
    require_human_commit: true,
    proposal: {
      mcp_tool: INTENT_TOOLS.propose,
      args: { task_run_id: 'tr:blocked' }
    }
  }, {
    human_commit: true,
    committed_by: 'console:jared'
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'proposal_not_ready');
});

test('none intent card stays non-mutating', () => {
  const card = compileIntentProposalCard({
    ok: true,
    intent: 'none',
    summary: 'No supported consequential intent found.'
  });
  assert.equal(card.intent, 'none');
  assert.equal(card.require_human_commit, false);
  assert.equal(card.auto_mutated, false);
  assert.equal(card.dispatched, false);
  assert.equal(card.accepted_state_authority, false);
  assert.equal(card.proposal, null);
});

test('blocked route result stays blocked even with stray tool fields', () => {
  const card = compileIntentProposalCard({
    ok: false,
    intent: 'assign',
    mcp_tool: INTENT_TOOLS.propose,
    errors: ['missing assignee']
  });
  assert.equal(card.ok, false);
  assert.equal(card.proposal, null);
});

test('dispatch args require human commit and strip ui-only extras', () => {
  const blocked = buildDispatchCommitArgs({
    task_run_id: 'tr:123',
    human_commit: false,
    committed_by: 'console:jared'
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.errors[0], /human commit/i);

  const args = buildDispatchCommitArgs({
    task_run_id: 'tr:123',
    human_commit: true,
    committed_by: 'console:jared',
    preferred_executor: 'claude',
    policy_preset: 'safe',
    base_commit_sha: 'abc123',
    accepted_state_authority: true
  });
  assert.equal(args.ok, true);
  assert.deepEqual(args.args, {
    task_run_id: 'tr:123',
    human_commit: true,
    committed_by: 'console:jared',
    preferred_executor: 'claude',
    policy_preset: 'safe',
    base_commit_sha: 'abc123'
  });
  assert.equal(args.args.accepted_state_authority, undefined);
});

test('queued task is not dispatchable', () => {
  const card = compileDispatchCommitCard({
    task_run_id: 'tr:queued',
    status: 'queued'
  });
  assert.equal(card.ok, false);
  assert.equal(card.dispatchable, false);
  assert.equal(card.accepted_state_authority, false);
});

test('proposed task is dispatchable with compiled_transmitted receipt', () => {
  const card = compileDispatchCommitCard({
    task_run: {
      task_run_id: 'tr:proposed',
      status: 'proposed'
    },
    context_resolution: 'compiled_transmitted',
    receipts: [{ receipt_kind: 'compiled_transmitted' }]
  });
  assert.equal(card.dispatchable, true);
  assert.equal(card.receipt_kind, 'compiled_transmitted');
  const summary = summarizeProposalCard(card);
  assert.match(summary.title, /dispatch/i);
  assert.ok(summary.lines.some(line => /compiled_transmitted/.test(line)));
});

test('module exports and work wiring are present', () => {
  assert.equal(INTENT_PROPOSAL_SCHEMA.type, 'object');
  assert.equal(DISPATCH_COMMIT_SCHEMA.type, 'object');
  assert.equal(INTENT_TOOLS.route, 'cairnstone_intent_route');
  assert.deepEqual(
    pickAllowedArgs(['task_run_id', 'human_commit'], {
      task_run_id: 'tr:1',
      human_commit: true,
      accepted_state_authority: true
    }),
    { task_run_id: 'tr:1', human_commit: true }
  );

  const app = readFileSync(join(root, 'app.js'), 'utf8');
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.match(app, /summarizeProposalCard as summarizeIntentCard/);
  assert.match(app, /function routeConsoleIntent\(/);
  assert.match(app, /function commitConsoleProposal\(/);
  assert.match(app, /function commitConsoleDispatch\(/);
  assert.match(app, /cairnstone_intent_route|INTENT_TOOLS\.route/);
  assert.match(app, /commitProposalTool|compileIntentProposalCard/);
  assert.match(app, /cairnstone_task_run_dispatch|INTENT_TOOLS\.dispatch/);
  assert.match(app, /committed_by_required/);
  assert.match(app, /proposal_not_ready/);
  const routeSlice = app.slice(app.indexOf('function routeConsoleIntent('), app.indexOf('async function commitConsoleProposal('));
  const proposalSlice = app.slice(app.indexOf('async function commitConsoleProposal('), app.indexOf('async function commitConsoleDispatch('));
  const dispatchSlice = app.slice(app.indexOf('async function commitConsoleDispatch('), app.indexOf('async function refreshAccessGrants('));
  assert.doesNotMatch(routeSlice, /set_head|set_path_head/);
  assert.doesNotMatch(proposalSlice, /set_head|set_path_head/);
  assert.doesNotMatch(dispatchSlice, /set_head|set_path_head/);
  assert.match(app, /dispatchCard\?\.task_run_id === taskRunId[\s\S]+dispatchCard\.dispatchable === true/);
  assert.match(app, /committed\.task_run_id[\s\S]+committed\.task_run\?\.task_run_id[\s\S]+proposal\.args\.task_run_id[\s\S]+state\.intent\.proposalCard\?\.task_run_id/);
  assert.match(app, /committed\.status \|\| committed\.task_run\?\.status \|\| 'proposed'/);

  for (const id of [
    'intentText',
    'intentRouteButton',
    'intentHumanCommit',
    'intentCommitProposal',
    'dispatchTaskRunId',
    'dispatchHumanCommit',
    'dispatchCommitButton',
    'intentResult'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});
