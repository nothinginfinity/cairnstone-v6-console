/**
 * Unit tests for V7.7.10b Give Access / Assign / Forward helpers.
 * Run: node --test access-share.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ACCESS_GRANT_TOOLS,
  GRANT_PERMISSIONS,
  HUMAN_COMMIT_OPS,
  parseObjectRef,
  formatObjectRef,
  objectRefFromMessage,
  objectRefFromStone,
  objectRefFromRepo,
  objectRefFromCodeSession,
  objectRefFromResponse,
  permissionImpliesExecute,
  permissionLabel,
  grantStatusLabel,
  buildAccessGrantProposal,
  buildAssignProposal,
  buildAttachmentResolveArgs,
  buildForwardWithNotePayload,
  buildRevokeProposal,
  isToolMissingError,
  toolMissingHonesty,
  summarizeProposalCard,
  localResolveAttachment,
  sanitizeMcpArgs,
  mcpArgsFromProposal,
  entrySurfaces,
  assertShareNeverMovesHeads
} from './access-share.js';

const root = join(dirname(fileURLToPath(import.meta.url)));

test('canonical object refs parse and format', () => {
  assert.deepEqual(parseObjectRef('msg:abc-123'), { kind: 'msg', id: 'abc-123', raw: 'msg:abc-123' });
  assert.equal(formatObjectRef('stone', 'deadbeef'), 'stone:deadbeef');
  assert.equal(parseObjectRef('not-a-ref'), null);
  assert.equal(formatObjectRef('stone', ''), null);
});

test('builders from message / stone / repo / session / response', () => {
  const msg = objectRefFromMessage({ message_id: 'm1', stone_hash: 'h1', subject: 'Hello' });
  assert.equal(msg.object_ref, 'msg:m1');
  assert.deepEqual(msg.secondary_refs, ['stone:h1']);

  const stone = objectRefFromStone({ hash: 'aabb', title: 'T', repo: 'org/r', commit: 'c'.repeat(40) });
  assert.equal(stone.object_ref, 'stone:aabb');
  assert.ok(stone.secondary_refs[0].startsWith('repo:org/r@'));

  assert.equal(objectRefFromRepo({ repo: 'a/b', commit_sha: 'sha1' }).object_ref, 'repo:a/b@sha1');
  assert.equal(objectRefFromCodeSession('cs:1').object_ref, 'session:cs:1');
  assert.equal(objectRefFromResponse({ response_id: 'gr:9' }).object_ref, 'response:gr:9');
});

test('Give Access MCP args match live create schema (no accepted_state_authority)', () => {
  const bad = buildAccessGrantProposal({});
  assert.equal(bad.ok, false);
  assert.equal(bad.human_commit_required, true);

  const good = buildAccessGrantProposal({
    object_ref: 'msg:m1',
    principal_actor_id: 'grok:cairnstone-v6',
    permission: 'read',
    grantor_actor_id: 'console:jared',
    notify: true
  });
  assert.equal(good.ok, true);
  assert.equal(good.mcp_tool, ACCESS_GRANT_TOOLS.create);
  assert.equal(good.duplicates_payload, false);
  assert.equal(good.accepted_state_authority, false);
  assert.equal(good.permission_implies_execute, false);
  assert.equal(permissionImpliesExecute('execute-against'), false);
  assert.match(permissionLabel('read'), /visibility only/i);
  assert.ok(GRANT_PERMISSIONS.includes('discuss'));

  const args = mcpArgsFromProposal(good);
  assert.deepEqual(Object.keys(args).sort(), [
    'grantor_actor_id', 'notify', 'object_ref', 'permission', 'principal_actor_id'
  ]);
  assert.equal(args.accepted_state_authority, undefined);
  assert.equal('accepted_state_authority' in args, false);
});

test('Assign MCP args use requested_by + note (not requester_actor_id/task/status)', () => {
  const p = buildAssignProposal({
    object_refs: ['msg:m1', 'stone:h1'],
    assignee_actor_id: 'claude:cairnstone-v6',
    requester_actor_id: 'console:jared',
    task: 'Please review'
  });
  assert.equal(p.ok, true);
  assert.equal(p.auto_dispatch, false);
  assert.equal(p.grants_access, false);
  assert.equal(p.status, 'proposed');
  assert.equal(p.mcp_tool, ACCESS_GRANT_TOOLS.taskRunPropose);
  assert.ok(HUMAN_COMMIT_OPS.includes('assign-proposal'));

  const args = mcpArgsFromProposal(p);
  assert.deepEqual(args.attachment_refs, ['msg:m1', 'stone:h1']);
  assert.equal(args.assignee_actor_id, 'claude:cairnstone-v6');
  assert.equal(args.requested_by, 'console:jared');
  assert.equal(args.note, 'Please review');
  assert.equal(args.requester_actor_id, undefined);
  assert.equal(args.task, undefined);
  assert.equal(args.status, undefined);
  assert.equal(args.auto_dispatch, undefined);
  assert.equal(args.accepted_state_authority, undefined);
});

test('Forward prefers cairnstone_forward_with_note; falls back to send_message', () => {
  const f = buildForwardWithNotePayload({
    from: 'console:jared',
    to: ['claude:cairnstone-v6'],
    note: 'FYI — please see this.',
    original_object_ref: 'msg:m1'
  });
  assert.equal(f.ok, true);
  assert.equal(f.mcp_tool, ACCESS_GRANT_TOOLS.forwardWithNote);
  assert.equal(f.creates_new_correspondence, true);
  const args = mcpArgsFromProposal(f);
  assert.equal(args.object_ref, 'msg:m1');
  assert.equal(args.note, 'FYI — please see this.');
  assert.equal(args.from, 'console:jared');
  assert.equal(args.to, 'claude:cairnstone-v6');
  assert.equal(args.content, undefined);

  const fallback = buildForwardWithNotePayload({
    from: 'console:jared',
    to: ['claude:cairnstone-v6'],
    note: 'FYI',
    original_object_ref: 'msg:m1',
    preferForwardTool: false,
    forwardToolAvailable: false
  });
  assert.equal(fallback.mcp_tool, ACCESS_GRANT_TOOLS.sendMessage);
  assert.match(mcpArgsFromProposal(fallback).content, /msg:m1/);
});

test('Revoke MCP args are only grant_id + actor_id', () => {
  const r = buildRevokeProposal({ grant_id: 'ag:1', actor_id: 'console:jared' });
  assert.equal(r.ok, true);
  assert.equal(r.future_access_only, true);
  assert.equal(r.erases_already_read, false);
  assert.equal(grantStatusLabel('revoked'), 'Revoked (future access blocked)');
  const args = mcpArgsFromProposal(r);
  assert.deepEqual(args, { grant_id: 'ag:1', actor_id: 'console:jared' });
  assert.equal(args.accepted_state_authority, undefined);
});

test('attachment resolve tool name + args shape', () => {
  assert.equal(ACCESS_GRANT_TOOLS.attachmentResolve, 'cairnstone_attachment_ref_resolve');
  const args = buildAttachmentResolveArgs({
    object_ref: 'stone:abc',
    actor_id: 'console:jared'
  });
  assert.equal(args.object_ref, 'stone:abc');
  assert.deepEqual(args.object_refs, ['stone:abc']);
  assert.equal(args.actor_id, 'console:jared');
});

test('sanitizeMcpArgs strips forbidden extras', () => {
  const cleaned = sanitizeMcpArgs(ACCESS_GRANT_TOOLS.create, {
    object_ref: 'msg:1',
    principal_actor_id: 'a',
    permission: 'read',
    grantor_actor_id: 'b',
    accepted_state_authority: false,
    auto_dispatch: false,
    junk: true
  });
  assert.equal(cleaned.accepted_state_authority, undefined);
  assert.equal(cleaned.junk, undefined);
  assert.equal(cleaned.object_ref, 'msg:1');
});

test('tool missing honesty and local attachment resolve', () => {
  assert.equal(isToolMissingError(new Error('Unknown tool: cairnstone_access_grant_create')), true);
  assert.equal(isToolMissingError(new Error('network down')), false);
  const h = toolMissingHonesty(ACCESS_GRANT_TOOLS.create);
  assert.equal(h.available, false);
  assert.match(h.body, /0\.5\.40/);
  const local = localResolveAttachment('stone:abc');
  assert.equal(local.ok, true);
  assert.equal(local.resolved_locally, true);
  assert.match(local.note, /attachment_ref_resolve/);
  assert.equal(localResolveAttachment('nope').ok, false);
});

test('proposal card summary and entry surfaces', () => {
  const card = summarizeProposalCard(buildAccessGrantProposal({
    object_ref: 'msg:m1',
    principal_actor_id: 'grok:cairnstone-v6',
    permission: 'discuss',
    grantor_actor_id: 'console:jared'
  }));
  assert.match(card.title, /Commit/i);
  assert.ok(card.lines.some(l => /discuss/.test(l)));
  const surfaces = entrySurfaces();
  assert.ok(surfaces.some(s => s.surface === 'message-reader'));
  assert.ok(surfaces.some(s => s.surface === 'access'));
});

test('share helpers and app wiring never mcpCall HEAD tools', () => {
  const share = readFileSync(join(root, 'access-share.js'), 'utf8');
  const app = readFileSync(join(root, 'app.js'), 'utf8');
  assert.equal(assertShareNeverMovesHeads(share).ok, true);
  assert.equal(assertShareNeverMovesHeads(app).ok, true);
  assert.doesNotMatch(share, /mcpCall\(/);
  assert.match(app, /mcpArgsFromProposal|sanitizeMcpArgs/);
  assert.match(app, /cairnstone_attachment_ref_resolve|ACCESS_GRANT_TOOLS\.attachmentResolve/);
  assert.match(ACCESS_GRANT_TOOLS.create, /cairnstone_access_grant_create/);
  assert.match(ACCESS_GRANT_TOOLS.attachmentResolve, /cairnstone_attachment_ref_resolve/);
  assert.doesNotMatch(ACCESS_GRANT_TOOLS.attachmentResolve, /cairnstone_attachment_resolve$/);
});
